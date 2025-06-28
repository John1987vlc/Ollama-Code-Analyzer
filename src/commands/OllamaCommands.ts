// src/commands/OllamaCommands.ts

import * as vscode from 'vscode';
import { ExtensionServices } from '../extension';
import { getRelativeFilePath } from '../utils/pathUtils'; // Moveremos la función aquí

/**
 * Controlador central para ejecutar el análisis.
 * @param document El documento a analizar.
 * @param services Los servicios de la extensión.
 */
export async function runAnalysis(
    document: vscode.TextDocument | undefined, 
    services: ExtensionServices
) {
    if (!document) {
        vscode.window.showInformationMessage("Por favor, abre un archivo para analizar.");
        return;
    }

    const { codeAnalyzer, gitContextAnalyzer, giteaService, gitContextProvider } = services;

    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const useGitContext = config.get<boolean>('gitea.useContextualAnalysis', true);

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Analizandocon el modelo configurado'}...`,
        cancellable: true
    }, async (progress, token) => {
        if (useGitContext && await giteaService.isConfigured()) {
            await gitContextAnalyzer.analyzeFileWithGitContext(document);
            const relativePath = getRelativeFilePath(document.uri);
            if (relativePath && !token.isCancellationRequested) {
                gitContextProvider.refresh(relativePath);
            }
        } else {
            await codeAnalyzer.analyzeDocument(document);
        }
    });
}


export function registerOllamaCommands(context: vscode.ExtensionContext, services: ExtensionServices) {
    // Comando para análisis manual con atajo de teclado
    const analyzeFileCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.analyzeCurrentFile', () => {
        runAnalysis(vscode.window.activeTextEditor?.document, services);
    });

    // Comando para menú contextual con Gemma
    const analyzeWithGemmaCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.analyzeWithGemma', () => {
        runAnalysis(vscode.window.activeTextEditor?.document, services);
    });

    context.subscriptions.push(analyzeFileCommand, analyzeWithGemmaCommand);
}