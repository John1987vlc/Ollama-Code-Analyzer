// src/services/CodeAnalyzer.ts
import * as vscode from 'vscode';
import { OllamaService } from './OllamaService';
import { PromptingService } from './PromptingService'; // Importamos el servicio de prompts
import { createHash } from 'crypto';

// ... (interfaces sin cambios) ...
export interface CodeSuggestion {
    line: number;
    column: number;
    endLine?: number; // Opcional: línea donde termina la sugerencia
    endColumn?: number; // Opcional: columna donde termina la sugerencia
    message: string;
    severity: 'error' | 'warning' | 'info';
    code?: string; // Código sugerido para reemplazar el original
}

export interface AnalysisResult {
    suggestions: CodeSuggestion[];
    summary: string;
    timestamp: Date;
}


export class CodeAnalyzer {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private outputChannel: vscode.OutputChannel;
    private analysisCache = new Map<string, AnalysisResult>();
    private promptingService: PromptingService; // Añadimos el servicio

    constructor(private ollamaService: OllamaService) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ollamaCodeAnalyzer');
        this.outputChannel = vscode.window.createOutputChannel('Ollama Code Analyzer');
        this.promptingService = new PromptingService(); // Lo instanciamos
    }

    async analyzeDocument(document: vscode.TextDocument, modelOverride?: string): Promise<AnalysisResult | null> {
        const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
        const model = modelOverride || config.get<string>('model', 'codellama:latest');
        const maxLines = config.get<number>('maxLines', 200);

        if (document.isUntitled || document.lineCount > maxLines) {
            return null;
        }

        const code = document.getText();
        const cacheKey = this.generateCacheKey(document.uri.toString(), code);

        if (this.analysisCache.has(cacheKey)) {
            const cachedResult = this.analysisCache.get(cacheKey)!;
            this.updateDiagnostics(document, cachedResult);
            return cachedResult;
        }

        try {
            // Ahora usamos el promptingService para obtener el prompt
            const prompt = await this.promptingService.getAnalysisPrompt(code, document.languageId);

            const response = await this.ollamaService.generate(prompt, model, {
                temperature: 0.1,
                top_p: 0.9
            });

            if (!response || !response.response) {
                throw new Error('Respuesta vacía de Ollama');
            }
            
            const analysisResult = this.parseAnalysisResponse(response.response);
            this.analysisCache.set(cacheKey, analysisResult);
            this.updateDiagnostics(document, analysisResult);
            
            return analysisResult;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Ollama Code Analyzer: ${errorMessage}`);
            return null;
        }
    }

    // Se elimina el método `createAnalysisPrompt` de aquí.

    private parseAnalysisResponse(response: string): AnalysisResult {
        try {
            const jsonMatch = response.match(/```json\s*(\{[\s\S]*\})\s*```|\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No se encontró un objeto JSON en la respuesta.");
            }
            
            const jsonString = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonString);

            return {
                suggestions: parsed.suggestions || [],
                summary: parsed.summary || 'Análisis completado sin resumen.',
                timestamp: new Date()
            };
        } catch (error) {
            console.error("Error al parsear JSON:", error);
            return {
                suggestions: [],
                summary: 'Error: No se pudo interpretar el análisis de Ollama.',
                timestamp: new Date()
            };
        }
    }
    
    // ... (resto de métodos sin cambios: updateDiagnostics, mapSeverity, etc.) ...
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
    
    private generateCacheKey(uri: string, content: string): string {
        const hash = createHash('sha256').update(content).digest('hex');
        return `${uri}:${hash}`;
    }
}