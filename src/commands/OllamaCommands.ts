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

    // --- LOG ---
    console.log(`[OllamaCommands] Iniciando análisis para: ${document.uri.fsPath}`);

    const { codeAnalyzer, gitContextAnalyzer, giteaService, gitContextProvider } = services;

    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const useGitContext = config.get<boolean>('gitea.useContextualAnalysis', true);

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Analizando con el modelo configurado...`,
        cancellable: true
    }, async (progress, token) => {
        if (useGitContext && await giteaService.isConfigured()) {
            // --- LOG ---
            console.log('[OllamaCommands] Usando análisis con contexto de Gitea.');
            await gitContextAnalyzer.analyzeFileWithGitContext(document);
            const relativePath = getRelativeFilePath(document.uri);
            if (relativePath && !token.isCancellationRequested) {
                gitContextProvider.refresh(relativePath);
            }
        } else {
            // --- LOG ---
            console.log('[OllamaCommands] Usando análisis de documento estándar.');
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