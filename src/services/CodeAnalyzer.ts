import * as vscode from 'vscode';
import { OllamaService } from './OllamaService';

export interface CodeSuggestion {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
    code?: string;
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
    
    constructor(private ollamaService: OllamaService) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ollamaCodeAnalyzer');
        this.outputChannel = vscode.window.createOutputChannel('Ollama Code Analyzer');
    }
    
    async analyzeDocument(document: vscode.TextDocument): Promise<AnalysisResult | null> {
        const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
        const model = config.get<string>('model', 'codellama');
        const maxLines = config.get<number>('maxLines', 200);
        
        try {
            // Verificar si el documento no es demasiado grande
            if (document.lineCount > maxLines) {
                this.outputChannel.appendLine(`Documento demasiado grande (${document.lineCount} líneas). Máximo permitido: ${maxLines}`);
                return null;
            }
            
            const code = document.getText();
            const cacheKey = this.generateCacheKey(document.uri.toString(), code);
            
            // Verificar cache
            if (this.analysisCache.has(cacheKey)) {
                const cachedResult = this.analysisCache.get(cacheKey)!;
                this.updateDiagnostics(document, cachedResult);
                return cachedResult;
            }
            
            this.outputChannel.appendLine(`Analizando ${document.fileName}...`);
            
            const prompt = this.createAnalysisPrompt(code, document.languageId);
            const response = await this.ollamaService.generate(prompt, model, {
                temperature: 0.1, // Baja temperatura para respuestas más consistentes
                top_p: 0.9
            });
            
            if (!response) {
                this.outputChannel.appendLine('No se pudo obtener respuesta de Ollama');
                return null;
            }
            
            const analysisResult = this.parseAnalysisResponse(response.response);
            
            // Guardar en cache
            this.analysisCache.set(cacheKey, analysisResult);
            
            // Actualizar diagnósticos
            this.updateDiagnostics(document, analysisResult);
            
            this.outputChannel.appendLine(`Análisis completado: ${analysisResult.suggestions.length} sugerencias`);
            return analysisResult;
            
        } catch (error) {
            this.outputChannel.appendLine(`Error analizando documento: ${error}`);
            console.error('Error en análisis de código:', error);
            return null;
        }
    }
    
    private createAnalysisPrompt(code: string, language: string): string {
        const languageMap: { [key: string]: string } = {
            'csharp': 'C#',
            'javascript': 'JavaScript',
            'typescript': 'TypeScript',
            'python': 'Python',
            'java': 'Java',
            'cpp': 'C++',
            'c': 'C'
        };
        
        const languageName = languageMap[language] || language;
        
        return `Eres un experto en ${languageName}. Analiza el siguiente código y proporciona sugerencias de mejora.

Código a analizar:
\`\`\`${language}
${code}
\`\`\`

Por favor, proporciona tu análisis en el siguiente formato JSON:
{
  "suggestions": [
    {
      "line": número_de_línea,
      "column": número_de_columna,
      "message": "descripción_de_la_sugerencia",
      "severity": "error|warning|info",
      "code": "código_mejorado_opcional"
    }
  ],
  "summary": "resumen_general_del_análisis"
}

Enfócate en:
- Problemas de sintaxis o lógica
- Mejores prácticas del lenguaje
- Optimizaciones de rendimiento
- Legibilidad del código
- Posibles bugs o vulnerabilidades

Proporciona solo el JSON sin texto adicional.`;
    }
    
    private parseAnalysisResponse(response: string): AnalysisResult {
        try {
            // Limpiar la respuesta para extraer solo el JSON
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No se encontró JSON válido en la respuesta');
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            
            return {
                suggestions: parsed.suggestions || [],
                summary: parsed.summary || 'Análisis completado',
                timestamp: new Date()
            };
        } catch (error) {
            this.outputChannel.appendLine(`Error parseando respuesta: ${error}`);
            return {
                suggestions: [],
                summary: 'Error al parsear el análisis',
                timestamp: new Date()
            };
        }
    }
    
    private updateDiagnostics(document: vscode.TextDocument, result: AnalysisResult) {
        const diagnostics: vscode.Diagnostic[] = result.suggestions.map(suggestion => {
            const line = Math.max(0, suggestion.line - 1); // VSCode usa índices basados en 0
            const column = Math.max(0, suggestion.column - 1);
            
            const range = new vscode.Range(
                new vscode.Position(line, column),
                new vscode.Position(line, column + 10) // Rango aproximado
            );
            
            const severity = this.mapSeverity(suggestion.severity);
            const diagnostic = new vscode.Diagnostic(range, suggestion.message, severity);
            diagnostic.source = 'Ollama Code Analyzer';
            
            return diagnostic;
        });
        
        this.diagnosticCollection.set(document.uri, diagnostics);
    }
    
    private mapSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity.toLowerCase()) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info': return vscode.DiagnosticSeverity.Information;
            default: return vscode.DiagnosticSeverity.Hint;
        }
    }
    
    private generateCacheKey(uri: string, content: string): string {
        // Crear un hash simple del contenido para el cache
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir a 32bit integer
        }
        return `${uri}:${hash}`;
    }
    
    clearCache() {
        this.analysisCache.clear();
        this.outputChannel.appendLine('Cache de análisis limpiado');
    }
    
    clearDiagnostics() {
        this.diagnosticCollection.clear();
    }
    
    dispose() {
        this.diagnosticCollection.dispose();
        this.outputChannel.dispose();
    }
}
