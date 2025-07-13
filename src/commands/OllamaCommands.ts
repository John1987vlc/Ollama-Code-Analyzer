// src/commands/OllamaCommands.ts

import * as vscode from 'vscode';
import { getRelativeFilePath } from '../utils/pathUtils';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { UnifiedResponseWebview } from '../ui/webviews'; // Asegúrate que la importación sea correcta

// [NUEVO Y CORREGIDO]
// Exportamos esta función para que los listeners de eventos (como guardar o abrir archivo) puedan usarla.
export async function runAnalysis(
    document: vscode.TextDocument,
    coreCtx: CoreExtensionContext,
    vsCodeCtx: vscode.ExtensionContext
) {
    const title = 'Análisis de Código con Ollama';
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const model = config.get<string>('model');

    if (!model) {
        // No mostramos error para no ser intrusivos en eventos automáticos
        console.error("Ollama: No se ha configurado un modelo.");
        return;
    }

    // Mostrar la webview de carga
    UnifiedResponseWebview.createOrShow(vsCodeCtx.extensionUri, title);
    UnifiedResponseWebview.currentPanel?.showLoading();

    try {
        const prompt = await coreCtx.promptingService.getAnalysisPrompt(document.getText(), document.languageId);
        const result = await coreCtx.ollamaService.generate(prompt, model);

        if (result && result.response && UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel.showResponse(result.response, result.prompt);
        } else if (UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel.showResponse("Ollama no devolvió una respuesta válida.", "Error de Respuesta");
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        if (UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel.showResponse(`Error durante el análisis: ${errorMessage}`, "Error de Ejecución");
        }
    }
}

/**
 * Registra todos los comandos relacionados con Ollama.
 * @param coreCtx El contexto central de la extensión que contiene todos los servicios.
 * @param vsCodeCtx El contexto de la extensión de VS Code para las suscripciones.
 */
export function registerOllamaCommands(coreCtx: CoreExtensionContext, vsCodeCtx: vscode.ExtensionContext) {
    
     // El comando manual ahora simplemente llama a la función `runAnalysis` exportada.
    const analyzeFileCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.analyzeCurrentFile', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            runAnalysis(editor.document, coreCtx, vsCodeCtx);
        } else {
            vscode.window.showInformationMessage("Por favor, abre un archivo para analizar.");
        }
    });
    
    // [CORREGIDO] Comando para configurar el modelo
    const configureModelCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.configureModel', 
        () => _configureModel(coreCtx));
    // --- Lógica centralizada para ejecutar comandos con la WebView ---
    const executeCommandWithWebview = async (
        title: string,
        serviceCall: () => Promise<{ prompt: string, response: string | null } | null>
    ) => {
        const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
        const model = config.get<string>('model');

        if (!model) {
            vscode.window.showErrorMessage("No se ha configurado un modelo de Ollama en los ajustes.");
            return;
        }

        UnifiedResponseWebview.createOrShow(vsCodeCtx.extensionUri, title);
        UnifiedResponseWebview.currentPanel?.showLoading();

        try {
            const result = await serviceCall();
            if (result && result.response && UnifiedResponseWebview.currentPanel) {
                UnifiedResponseWebview.currentPanel.showResponse(result.response, result.prompt);
            } else if (UnifiedResponseWebview.currentPanel) {
                UnifiedResponseWebview.currentPanel.showResponse("Ollama no devolvió una respuesta válida.", "Error de Respuesta");
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Error desconocido";
            if (UnifiedResponseWebview.currentPanel) {
                UnifiedResponseWebview.currentPanel.showResponse(`Error al ejecutar el comando: ${errorMessage}`, "Error de Ejecución");
            } else {
                vscode.window.showErrorMessage(`Error en el comando: ${errorMessage}`);
            }
        }
    };

    const findSuggestionsCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.findSuggestions', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        executeCommandWithWebview('Sugerencias de Refactorización', async () => {
            const prompt = await coreCtx.promptingService.getRefactorPrompt(editor.document.getText(), editor.document.languageId);
            const response = await coreCtx.ollamaService.generate(prompt, vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!);
            return { prompt, response: response?.response ?? null };
        });
    });
    
    const conceptualRefactorCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.conceptualRefactor', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage("Por favor, selecciona código para la refactorización.");
            return;
        }
        executeCommandWithWebview('Refactorización Conceptual', async () => {
            const selectedCode = editor.document.getText(editor.selection);
            const prompt = await coreCtx.promptingService.getConceptualRefactorPrompt(selectedCode, editor.document.languageId);
            const response = await coreCtx.ollamaService.generate(prompt, vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!);
            return { prompt, response: response?.response ?? null };
        });
    });

    // --- Comandos de Generación y Explicación de Código ---
    const generateUnitTestCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateUnitTest', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage("Selecciona código para generar un test.");
            return;
        }
        executeCommandWithWebview('Generación de Test Unitario', async () => {
            const selectedCode = editor.document.getText(editor.selection);
            const prompt = await coreCtx.promptingService.getUnitTestPrompt(selectedCode, editor.document.languageId);
            const response = await coreCtx.ollamaService.generate(prompt, vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!);
            return { prompt, response: response?.response ?? null };
        });
    });

    const explainCodeCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.explainCode', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage("Selecciona código para explicar.");
            return;
        }
        executeCommandWithWebview('Explicación de Código', async () => {
            const selectedCode = editor.document.getText(editor.selection);
            const prompt = await coreCtx.promptingService.getExplainPrompt(selectedCode, editor.document.languageId);
            const response = await coreCtx.ollamaService.generate(prompt, vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!);
            return { prompt, response: response?.response ?? null };
        });
    });
    
    // Añadir todos los comandos a las suscripciones para que se gestionen correctamente
    vsCodeCtx.subscriptions.push(
        analyzeFileCommand,
        findSuggestionsCommand,
        conceptualRefactorCommand,
        generateUnitTestCommand,
        explainCodeCommand,
        configureModelCommand // [AÑADIDO] El comando ahora se registra.
        // Añadir aquí el resto de comandos que se registren.
    );
}

// =====================================================================================
// --- Lógica de Implementación de Comandos (Funciones Privadas) ---
// =====================================================================================

/**
 * Muestra la lista de modelos disponibles y guarda la selección del usuario.
 */
async function _configureModel(coreCtx: CoreExtensionContext) {
    const { ollamaService } = coreCtx;
    try {
        const models = await ollamaService.getModels();
        if (!models || models.length === 0) {
            vscode.window.showWarningMessage("No se encontraron modelos en Ollama. Asegúrate de que el servicio esté corriendo.");
            return;
        }

        const modelItems = models.map(m => ({
            label: m.name,
            description: `Familia: ${m.details.family}`
        }));
        
        const selectedModel = await vscode.window.showQuickPick(modelItems, {
            placeHolder: 'Selecciona el modelo de IA a utilizar',
            title: 'Configurar Modelo'
        });

        if (selectedModel) {
            await vscode.workspace.getConfiguration('ollamaCodeAnalyzer').update('model', selectedModel.label, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Modelo actualizado a: ${selectedModel.label}`);
        }
    } catch (e) {
        vscode.window.showErrorMessage(`No se pudieron obtener los modelos de Ollama: ${e instanceof Error ? e.message : 'Desconocido'}`);
    }
}