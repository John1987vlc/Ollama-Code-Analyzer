import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { OllamaService } from './OllamaService';
import { createHash } from 'crypto'; // Usar el módulo crypto de Node para un hash más robusto

// --- INTERFACES MEJORADAS ---

/**
 * Representa una sugerencia de código individual generada por el análisis.
 * Se han añadido `endLine` y `endColumn` para diagnósticos más precisos.
 */
export interface CodeSuggestion {
    line: number;
    column: number;
    endLine?: number; // Opcional: línea donde termina la sugerencia
    endColumn?: number; // Opcional: columna donde termina la sugerencia
    message: string;
    severity: 'error' | 'warning' | 'info';
    code?: string; // Código sugerido para reemplazar el original
}

/**
 * Representa el resultado completo de un análisis de código.
 */
export interface AnalysisResult {
    suggestions: CodeSuggestion[];
    summary: string;
    timestamp: Date;
}

// --- CONSTANTES PARA CONFIGURACIÓN ---
const CONFIG_KEYS = {
    MODEL: 'ollamaCodeAnalyzer.model',
    MAX_LINES: 'ollamaCodeAnalyzer.maxLines',
    // Podrías añadir más configuraciones aquí
};

export class CodeAnalyzer {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private outputChannel: vscode.OutputChannel;
    private analysisCache = new Map<string, AnalysisResult>();

    constructor(private ollamaService: OllamaService) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ollamaCodeAnalyzer');
        this.outputChannel = vscode.window.createOutputChannel('Ollama Code Analyzer');
    }

    /**
     * Analiza un documento de texto usando Ollama.
     * @param document El documento de VS Code a analizar.
     * @returns Una promesa que se resuelve con el resultado del análisis o null si se omite o falla.
     */
     
async analyzeDocument(document: vscode.TextDocument, modelOverride?: string): Promise<AnalysisResult | null> {
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const model = modelOverride || config.get<string>('model', 'gemma3n:latest');
    const maxLines = config.get<number>('maxLines', 200);

    if (document.isUntitled || document.lineCount > maxLines) {
        if (document.lineCount > maxLines) {
            this.outputChannel.appendLine(`Análisis omitido: el documento es demasiado grande (${document.lineCount} líneas). Máximo configurado: ${maxLines}.`);
        }
        return null;
    }

    try {
        const code = document.getText();
        const cacheKey = this.generateCacheKey(document.uri.toString(), code);

        if (this.analysisCache.has(cacheKey)) {
            const cachedResult = this.analysisCache.get(cacheKey)!;
            this.updateDiagnostics(document, cachedResult);
            this.outputChannel.appendLine(`Análisis de '${document.fileName}' cargado desde caché.`);
            return cachedResult;
        }

        // --- LOG ---
        console.log(`[CodeAnalyzer] Iniciando análisis para ${document.fileName} con el modelo ${model}.`);
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: "Analizando código con Ollama...",
            cancellable: false
        }, async () => {
            const prompt = this.createAnalysisPrompt(code, document.languageId);

            // --- LOG ---
            console.log("[CodeAnalyzer] Prompt generado para Ollama:", prompt);

            const response = await this.ollamaService.generate(prompt, model, {
                temperature: 0.1,
                top_p: 0.9
            });
            
            // --- LOG ---
            console.log("[CodeAnalyzer] Respuesta recibida de OllamaService:", response);


            if (!response || !response.response) {
                console.error('[CodeAnalyzer] Error: No se pudo obtener una respuesta válida de Ollama.');
                this.outputChannel.appendLine('Error: No se pudo obtener una respuesta válida de Ollama.');
                throw new Error('Respuesta vacía de Ollama');
            }
            
            // --- LOG ---
            console.log("[CodeAnalyzer] Respuesta cruda (string) de Ollama:", response.response);
            
            const analysisResult = this.parseAnalysisResponse(response.response);
            
            this.analysisCache.set(cacheKey, analysisResult);
            this.updateDiagnostics(document, analysisResult);
            
            this.outputChannel.appendLine(`Análisis completado: ${analysisResult.suggestions.length} sugerencia(s) encontrada(s).`);

            if (analysisResult.suggestions.length === 0) {
                vscode.window.showInformationMessage("Análisis completado. No se encontraron sugerencias.");
            }
        });
        
        return this.analysisCache.get(cacheKey) || null;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // --- LOG ---
        console.error(`[CodeAnalyzer] Error durante el análisis del documento:`, error);
        this.outputChannel.appendLine(`Error durante el análisis del documento: ${errorMessage}`);
        vscode.window.showErrorMessage(`Ollama Code Analyzer: ${errorMessage}`);
        return null;
    }
}

    /**
     * **[MEJORA CLAVE]** Crea un prompt mucho más detallado y específico para el LLM.
     * @param code El código fuente a analizar.
     * @param language El identificador de lenguaje (ej. 'typescript').
     * @returns El prompt completo para enviar a Ollama.
     */
    private createAnalysisPrompt(code: string, language: string): string {
        const promptPath = path.resolve(__dirname, 'analysisPrompt.txt');
        let template = fs.readFileSync(promptPath, 'utf-8');

        // Obtenemos el nombre "bonito" del lenguaje para el prompt
        const languageName = this.getLanguageName(language);

        // --- CORRECCIÓN ---
        // Usamos la sintaxis correcta de los placeholders (${...}) que definiste en el .txt
        const prompt = template
            .replace(/\$\{languageName\}/g, languageName)
            .replace(/\$\{language\}/g, language)
            .replace(/\$\{code\}/g, code);

        return prompt;
    }
    
    /**
     * Parsea la respuesta en string de Ollama a un objeto `AnalysisResult`.
     * @param response La respuesta en bruto de Ollama.
     * @returns Un objeto `AnalysisResult` bien formado.
     */
    private parseAnalysisResponse(response: string): AnalysisResult {
    try {
        // --- LOG ---
        console.log("[CodeAnalyzer] Intentando parsear la respuesta...");
        const jsonMatch = response.match(/```json\s*(\{[\s\S]*\})\s*```|\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No se encontró un objeto JSON en la respuesta de Ollama.");
        }
        
        const jsonString = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonString);

        if (!parsed || typeof parsed !== 'object') {
            throw new Error("El JSON parseado no es un objeto válido.");
        }

        // --- LOG ---
        console.log("[CodeAnalyzer] Respuesta parseada con éxito:", parsed);

        const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
        const summary = typeof parsed.summary === 'string' ? parsed.summary : 'Análisis completado sin resumen.';
        
        return {
            suggestions,
            summary,
            timestamp: new Date()
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // --- LOG ---
        console.error("[CodeAnalyzer] Error al parsear JSON. Respuesta original:", response);
        this.outputChannel.appendLine(`Error al parsear la respuesta de Ollama: ${errorMessage}`);
        
        return {
            suggestions: [],
            summary: 'Error: No se pudo interpretar el análisis de Ollama.',
            timestamp: new Date()
        };
    }
}
    /**
     * **[MEJORA CLAVE]** Actualiza los diagnósticos en el editor usando rangos precisos.
     * @param document El documento al que se aplican los diagnósticos.
     * @param result El resultado del análisis que contiene las sugerencias.
     */
    private updateDiagnostics(document: vscode.TextDocument, result: AnalysisResult) {
        const diagnostics: vscode.Diagnostic[] = result.suggestions.map(suggestion => {
            const line = Math.max(0, suggestion.line - 1); // VSCode es 0-indexado
            const column = Math.max(0, suggestion.column - 1);

            // Usa las coordenadas de fin si están disponibles, si no, subraya toda la línea.
            const endLine = suggestion.endLine ? Math.max(0, suggestion.endLine - 1) : line;
            let endColumn;
            if (suggestion.endColumn) {
                endColumn = Math.max(0, suggestion.endColumn - 1);
            } else {
                // Alternativa: Subrayar hasta el final de la línea del problema
                endColumn = document.lineAt(line).range.end.character;
            }
            
            const range = new vscode.Range(line, column, endLine, endColumn);
            
            const severity = this.mapSeverity(suggestion.severity);
            const diagnostic = new vscode.Diagnostic(range, suggestion.message, severity);
            diagnostic.source = 'Ollama Code Analyzer';
            // Opcional: si quieres usar `suggestion.code` para una acción rápida
            diagnostic.code = suggestion.code; 
            
            return diagnostic;
        });

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private mapSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity?.toLowerCase()) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info': return vscode.DiagnosticSeverity.Information;
            default: return vscode.DiagnosticSeverity.Hint;
        }
    }

    /**
     * **[MEJORA CLAVE]** Genera una clave de caché usando un hash SHA256.
     * @param uri El URI del documento.
     * @param content El contenido del documento.
     * @returns Una clave de caché única.
     */
    private generateCacheKey(uri: string, content: string): string {
        const hash = createHash('sha256').update(content).digest('hex');
        return `${uri}:${hash}`;
    }

    private getLanguageName(languageId: string): string {
        const languageMap: { [key: string]: string } = {
            'csharp': 'C#',
            'javascript': 'JavaScript',
            'typescript': 'TypeScript',
            'python': 'Python',
            'java': 'Java',
            'cpp': 'C++',
            'c': 'C',
            'go': 'Go',
            'rust': 'Rust'
        };
        return languageMap[languageId] || languageId;
    }

    /** Limpia la caché de análisis. */
    clearCache() {
        this.analysisCache.clear();
        this.outputChannel.appendLine('Caché de análisis limpiada.');
    }

    /** Limpia todos los diagnósticos visibles. */
    clearDiagnostics() {
        this.diagnosticCollection.clear();
    }

    /** Libera los recursos utilizados por la clase. */
    dispose() {
        this.clearDiagnostics();
        this.diagnosticCollection.dispose();
        this.outputChannel.dispose();
    }
}