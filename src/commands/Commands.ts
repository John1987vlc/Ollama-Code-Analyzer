// src/commands/commands.ts
import * as vscode from 'vscode';
import { OllamaService } from '../api/OllamaService';
import { CodeAnalyzer } from '../services/CodeAnalyzer';

export function registerCommands(
    context: vscode.ExtensionContext,
    ollamaService: OllamaService,
    codeAnalyzer: CodeAnalyzer
) {
    // Comando para analizar el documento activo manualmente
    const analyzeDocumentCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.analyzeCurrentFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            await codeAnalyzer.analyzeDocument(editor.document);
        } else {
            vscode.window.showInformationMessage('Por favor, abre un archivo para analizar.');
        }
    });

    // Comando para seleccionar el modelo de Ollama a utilizar
    const selectModelCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.selectModel', async () => {
        try {
            const models = await ollamaService.getModels();
            const modelNames = models.map(m => m.name);
            const selectedModel = await vscode.window.showQuickPick(modelNames, {
                placeHolder: 'Selecciona el modelo de Ollama a utilizar'
            });

            if (selectedModel) {
                await vscode.workspace.getConfiguration('ollamaCodeAnalyzer').update('model', selectedModel, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Modelo de Ollama cambiado a: ${selectedModel}`);
            }
        } catch (e) {
            vscode.window.showErrorMessage('No se pudieron obtener los modelos de Ollama. ¿Está el servicio en ejecución?');
        }
    });

    // Comando para limpiar los diagnósticos (problemas) de la vista
    const clearDiagnosticsCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.clearDiagnostics', () => {
        codeAnalyzer.clearDiagnostics();
        vscode.window.showInformationMessage('Diagnósticos del analizador de código limpiados.');
    });


    context.subscriptions.push(
        analyzeDocumentCommand,
        selectModelCommand,
        clearDiagnosticsCommand
    );
}