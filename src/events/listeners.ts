// src/events/listeners.ts

import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { runAnalysis } from '../commands/OllamaCommands'; // La importación ahora funciona
import { debounce } from '../utils/debounce';
import { getRelativeFilePath } from '../utils/pathUtils';
import { updateGiteaStatusBar } from '../ui/statusBar';

/**
 * Registra todos los listeners de eventos de VS Code para la extensión.
 */
export function registerEventListeners(
    context: vscode.ExtensionContext, 
    coreCtx: CoreExtensionContext,
    giteaStatusBarItem: vscode.StatusBarItem 
) {
    const { gitContextProvider, giteaService } = coreCtx;

    /**
     * Función central para manejar un análisis, respetando la configuración del usuario.
     */
    const handleAnalysis = (document: vscode.TextDocument, configKey: 'autoAnalyze' | 'analyzeOnOpen' | 'analyzeOnSave') => {
        const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
        if (!config.get<boolean>(configKey, false)) return;

        const supportedLanguages = config.get<string[]>('supportedLanguages', []);
        if (supportedLanguages.includes(document.languageId) && !document.isUntitled) {
            // [CORREGIDO] Pasamos el vsCodeContext a la función
            runAnalysis(document, coreCtx, context);
        }
    };

    const debouncedLiveAnalysis = debounce(
        (document: vscode.TextDocument) => handleAnalysis(document, 'autoAnalyze'), 
        1500
    );

    // --- LISTENER: Al cambiar el editor de texto activo ---
    const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(async editor => {
        if (editor) {
            let relativePath = getRelativeFilePath(editor.document.uri);
            if(relativePath === null) {
                relativePath = "./";
            }
            gitContextProvider.refresh(relativePath);
            await updateGiteaStatusBar(giteaService, giteaStatusBarItem);
            
            // Opcionalmente, analizar el archivo cuando se enfoca.
            handleAnalysis(editor.document, 'analyzeOnOpen');
        } else {
            gitContextProvider.refresh(undefined);
        }
    });

    // --- LISTENER: Al abrir un nuevo documento ---
    const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(document => {
        handleAnalysis(document, 'analyzeOnOpen');
    });

    // --- LISTENER: Al cambiar el contenido del documento (mientras se escribe) ---
    const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(event => {
        debouncedLiveAnalysis(event.document);
    });
    
    // --- LISTENER: Al guardar un documento ---
    const onDidSaveTextDocument = vscode.workspace.onDidSaveTextDocument(document => {
        handleAnalysis(document, 'analyzeOnSave');
    });

    context.subscriptions.push(
        onDidChangeActiveTextEditor,
        onDidOpenTextDocument,
        onDidChangeTextDocument,
        onDidSaveTextDocument
    );
}