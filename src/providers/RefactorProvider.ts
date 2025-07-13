import * as vscode from 'vscode';
import { ExtensionServices } from '../extension';

const severityMap = {
    'Warning': vscode.DiagnosticSeverity.Warning,
    'Information': vscode.DiagnosticSeverity.Information,
    'Error': vscode.DiagnosticSeverity.Error,
    'Hint': vscode.DiagnosticSeverity.Hint,
};

interface ICodeSuggestion {
    lineStart: number;
    charStart: number;
    lineEnd: number;
    charEnd: number;
    message: string;
    severity: 'Warning' | 'Information' | 'Error' | 'Hint';
}

export class RefactorProvider implements vscode.CodeActionProvider {
    public static readonly metadata: vscode.CodeActionProviderMetadata = {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    };

    constructor(
        private services: ExtensionServices,
        private diagnosticCollection: vscode.DiagnosticCollection
    ) {}

    public async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
        if (!['javascript', 'typescript', 'python', 'java', 'csharp'].includes(document.languageId)) {
            return;
        }

        try {
              const { ollamaService } = this.services;
            const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
            // [CORREGIDO] Se elimina el fallback
            const model = config.get<string>('model');
             if (!model) { return; }
            // Inicializar como array vacío
            let suggestions: ICodeSuggestion[] = [];
            
            if (typeof ollamaService.getRefactoringSuggestions === 'function') {
                const result = await ollamaService.getRefactoringSuggestions(
                    document.getText(),
                    document.languageId,
                    model
                );
                // Asegurar que el resultado es siempre un array
                suggestions = Array.isArray(result) ? result : [];
            } else {
                // Usar el método generate existente
                suggestions = await this.getRefactoringSuggestionsWithGenerate(
                    document.getText(),
                    document.languageId,
                    model,
                    ollamaService
                );
            }

            const diagnostics: vscode.Diagnostic[] = suggestions.map(suggestion => {
                const range = new vscode.Range(
                    new vscode.Position(suggestion.lineStart, suggestion.charStart),
                    new vscode.Position(suggestion.lineEnd, suggestion.charEnd)
                );
                const diagnostic = new vscode.Diagnostic(
                    range,
                    suggestion.message,
                    severityMap[suggestion.severity] || vscode.DiagnosticSeverity.Information
                );
                diagnostic.source = 'Ollama Refactor';
                return diagnostic;
            });

            this.diagnosticCollection.set(document.uri, diagnostics);
        } catch (error) {
            console.error('Error updating diagnostics:', error);
            // Limpiar diagnósticos en caso de error
            this.diagnosticCollection.set(document.uri, []);
        }
    }

    // Método alternativo usando generate
    private async getRefactoringSuggestionsWithGenerate(
        code: string,
        languageId: string,
        model: string,
        ollamaService: any
    ): Promise<ICodeSuggestion[]> {
        const prompt = `Analyze this ${languageId} code and provide refactoring suggestions. Return a JSON array with objects containing: lineStart, charStart, lineEnd, charEnd, message, and severity (Warning/Information/Error/Hint).

Code:
\`\`\`${languageId}
${code}
\`\`\`

Return only valid JSON array, no explanations:`;

        try {
            const response = await ollamaService.generate(prompt, model, {
                temperature: 0.1,
                stream: false
            });

            if (!response || !response.response) {
                return [];
            }

            // Intentar parsear la respuesta JSON
            const jsonMatch = response.response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                // Validar que es un array y que cada elemento tiene la estructura correcta
                if (Array.isArray(parsed)) {
                    return parsed.filter(this.isValidCodeSuggestion);
                }
            }

            return [];
        } catch (error) {
            console.error('Error generating suggestions:', error);
            return [];
        }
    }

    // Validador de tipo para ICodeSuggestion
    private isValidCodeSuggestion(obj: any): obj is ICodeSuggestion {
        return obj &&
            typeof obj.lineStart === 'number' &&
            typeof obj.charStart === 'number' &&
            typeof obj.lineEnd === 'number' &&
            typeof obj.charEnd === 'number' &&
            typeof obj.message === 'string' &&
            ['Warning', 'Information', 'Error', 'Hint'].includes(obj.severity);
    }

    public async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeAction[]> {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source === 'Ollama Refactor') {
                const action = await this.createFixAction(document, diagnostic);
                if (action) {
                    actions.push(action);
                }
            }
        }

        return actions;
    }

    private async createFixAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): Promise<vscode.CodeAction | null> {
        try {
              const { ollamaService } = this.services;
            const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
            // [CORREGIDO] Se elimina el fallback
            const model = config.get<string>('model');
            
            if (!model) { return null; }
            const codeBlock = document.getText(diagnostic.range);
            const instruction = diagnostic.message;

            const fixPrompt = `Given the following code snippet from a ${document.languageId} file:

\`\`\`${document.languageId}
${codeBlock}
\`\`\`

The user wants to apply this suggestion: "${instruction}".

Provide ONLY the replacement code. Do not include explanations, comments, or markdown ticks. If the suggestion is a deletion, provide an empty response.`;

            const response = await ollamaService.generate(fixPrompt, model, {
                temperature: 0.0,
                stream: false
            });

            if (!response || !response.response) {
                return null;
            }

            const replacementCode = response.response.trim().replace(/^```[\w]*\n|```$/g, '').trim();

            const action = new vscode.CodeAction(diagnostic.message, vscode.CodeActionKind.QuickFix);
            action.diagnostics = [diagnostic];
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, diagnostic.range, replacementCode);
            action.isPreferred = true;

            return action;
        } catch (error) {
            console.error('Error creating fix action:', error);
            return null;
        }
    }
}