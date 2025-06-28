// src/events/listeners.ts

import * as vscode from 'vscode';
import { ExtensionServices } from '../extension';
import { runAnalysis } from '../commands/OllamaCommands';
import { debounce } from '../utils/debounce'; // Moveremos la función aquí
import { getRelativeFilePath } from '../utils/pathUtils';

export function registerEventListeners(context: vscode.ExtensionContext, services: ExtensionServices,giteaStatusBarItem: vscode.StatusBarItem ) {
    const { gitContextProvider } = services;

    const debouncedAnalysis = debounce((document: vscode.TextDocument) => {
        runAnalysis(document, services);
    }, 1500); // Aumentar un poco el debounce para análisis en vivo

    // Listener para cambios en el documento (análisis en vivo)
    const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(event => {
        const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
        const autoAnalyze = config.get<boolean>('autoAnalyze', false); // Default es false
        const supportedLanguages = config.get<string[]>('supportedLanguages', []);
        
        if (autoAnalyze && supportedLanguages.includes(event.document.languageId)) {
            debouncedAnalysis(event.document);
        }
    });

    // ... (tus otros listeners como onDidChangeActiveTextEditor y onDidOpenTextDocument)
    // Puedes adaptar su lógica para que llamen a `runAnalysis` si es necesario.

    context.subscriptions.push(onDidChangeTextDocument, /* ... otros listeners ... */);
}