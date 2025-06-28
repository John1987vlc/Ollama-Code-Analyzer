import * as vscode from 'vscode';
import { OllamaService } from '../services/OllamaService';
import { CodeAnalyzer } from '../services/CodeAnalyzer';

export function registerCommands(
    context: vscode.ExtensionContext,
    ollamaService: OllamaService,
    codeAnalyzer: CodeAnalyzer
) {
    // Comando para analizar el documento actual
    const analyzeCurrentDocument = vscode.commands.registerCommand(
        'ollamaCodeAnalyzer.analyzeCurrentDocument',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No hay ningún editor activo');
                return;
            }
            
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analizando código...',
                cancellable: false
            }, async () => {
                await codeAnalyzer.analyzeDocument(editor.document);
            });
        }
    );
    
    // Comando para limpiar diagnósticos
    const clearDiagnostics = vscode.commands.registerCommand(
        'ollamaCodeAnalyzer.clearDiagnostics',
        () => {
            codeAnalyzer.clearDiagnostics();
            vscode.window.showInformationMessage('Diagnósticos limpiados');
        }
    );
    
    // Comando para mostrar modelos recomendados
    const showRecommendedModels = vscode.commands.registerCommand(
        'ollamaCodeAnalyzer.showRecommendedModels',
        async () => {
            const recommendations = [
                'codellama - Especializado en código',
                'deepseek-coder - Excelente para análisis de código',
                'starcoder - Bueno para múltiples lenguajes',
                'phind-codellama - Optimizado para explicaciones'
            ];
            
            const info = `Modelos recomendados para análisis de código:\n\n${recommendations.join('\n')}`;
            
            const doc = await vscode.workspace.openTextDocument({
                content: info,
                language: 'text'
            });
            await vscode.window.showTextDocument(doc);
        }
    );
    
    // Comando para configurar modelo
    const configureModel = vscode.commands.registerCommand(
        'ollamaCodeAnalyzer.configureModel',
        async () => {
            const models = await ollamaService.getModels();
            
            if (models.length === 0) {
                vscode.window.showWarningMessage('No hay modelos disponibles');
                return;
            }
            
            const modelNames = models.map(m => m.name);
            const selected = await vscode.window.showQuickPick(modelNames, {
                placeHolder: 'Selecciona el modelo para análisis de código'
            });
            
            if (selected) {
                const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
                await config.update('model', selected, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Modelo configurado: ${selected}`);
            }
        }
    );
    
    context.subscriptions.push(
        analyzeCurrentDocument,
        clearDiagnostics,
        showRecommendedModels,
        configureModel
    );
}