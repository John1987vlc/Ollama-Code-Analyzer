// src/commands/OllamaCommands.ts

import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { UnifiedResponseWebview } from '../ui/webviews'; // Asegúrate que la importación sea correcta
import { getRelativeFilePath } from '../utils/pathUtils'; // Importamos la utilidad

               
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
        // [CORREGIDO] Solo pasamos la respuesta. El prompt ya no es necesario aquí.
        UnifiedResponseWebview.currentPanel.showResponse(result.response);
    } else if (UnifiedResponseWebview.currentPanel) {
        // [CORREGIDO]
        UnifiedResponseWebview.currentPanel.showResponse("Ollama no devolvió una respuesta válida.");
    }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        if (UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel.showResponse(`Error durante el análisis: ${errorMessage}`);
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
      const analyzeDocumentCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.analyzeCurrentDocument', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            // Se llama a la misma lógica de análisis que ya tenías.
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
    // Parámetro para el mensaje de carga y título de la ventana
    loadingTitle: string, 
    serviceCall: () => Promise<{ prompt: string, response: string | null } | null>
) => {
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const model = config.get<string>('model');

    if (!model) {
        vscode.window.showErrorMessage("No se ha configurado un modelo de Ollama en los ajustes.");
        return;
    }

    // 1. Pasa el `loadingTitle` a la webview al crearla o mostrarla.
    //    `createOrShow` ahora se encargará de poner el mensaje de carga.
    UnifiedResponseWebview.createOrShow(vsCodeCtx.extensionUri, loadingTitle);

    try {
        const result = await serviceCall();
        
        if (UnifiedResponseWebview.currentPanel) {
            if (result && result.response) {
                // Muestra la respuesta si es válida
                UnifiedResponseWebview.currentPanel.showResponse(result.response);
            } else {
                // Muestra un mensaje de error si no hay respuesta
                UnifiedResponseWebview.currentPanel.showResponse("Ollama no devolvió una respuesta válida o el resultado fue nulo.");
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        if (UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel.showResponse(`Error al ejecutar el comando: ${errorMessage}`);
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
    
     const checkStandardsCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.checkCompanyStandards', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("Por favor, abre un archivo para validar sus estándares.");
            return;
        }
        
        executeCommandWithWebview('Validación de Estándares', async () => {
            const code = editor.document.getText();
            const languageId = editor.document.languageId;
            const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!;

            // Llama al servicio de prompts para obtener el prompt específico de esta tarea
            const prompt = await coreCtx.promptingService.getStandardsPrompt(code, languageId);
            const response = await coreCtx.ollamaService.generate(prompt, model);
            
            return { prompt, response: response?.response ?? null };
        });
    });
      const findDuplicateLogicCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.findDuplicateLogic', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("Por favor, abre un archivo para detectar lógica duplicada.");
            return;
        }
        
        executeCommandWithWebview('Detección de Lógica Duplicada', async () => {
            const code = editor.document.getText();
            const languageId = editor.document.languageId;
            const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!;

            // Llama al servicio de prompts para obtener el prompt específico de esta tarea
            const prompt = await coreCtx.promptingService.getDuplicateDetectionPrompt(code, languageId);
            const response = await coreCtx.ollamaService.generate(prompt, model);
            
            return { prompt, response: response?.response ?? null };
        });
    });

      const generateUmlDiagramCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateUmlDiagram', async () => {
        const title = 'Generación de Diagrama UML';
        
        // Función para recolectar todos los archivos relevantes del workspace
        const findProjectFiles = async (): Promise<{ path: string, content: string }[]> => {
            const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
            const supportedLanguages = config.get<string[]>('supportedLanguages', []);
            const fileExtensions = supportedLanguages.map(lang => `.${lang}`);
            
            // Busca archivos que coincidan con las extensiones de los lenguajes soportados
            const files = await vscode.workspace.findFiles(`**/*{${fileExtensions.join(',')}}`, '**/node_modules/**');
            
            const fileContents = await Promise.all(
                files.map(async (uri) => {
                    const document = await vscode.workspace.openTextDocument(uri);
                    return {
                        path: getRelativeFilePath(uri) || uri.fsPath,
                        content: document.getText()
                    };
                })
            );
            return fileContents;
        };

        await executeCommandWithWebview(title, async () => {
            const files = await findProjectFiles();
            if (files.length === 0) {
                vscode.window.showInformationMessage("No se encontraron archivos de código soportados en el proyecto.");
                return { prompt: "", response: "No se encontraron archivos para analizar." };
            }

            // Llamada al servicio de Ollama para generar el diagrama
            const response = await coreCtx.ollamaService.generateUmlDiagram(files, vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!);
            
            // Envolvemos la respuesta en un bloque de código plantuml para que la webview lo reconozca
            const wrappedResponse = response ? `\`\`\`plantuml\n${response}\n\`\`\`` : "No se pudo generar el diagrama.";

            return { prompt: "UML Generation", response: wrappedResponse };
        });
    });

    // Añadir todos los comandos a las suscripciones para que se gestionen correctamente
    vsCodeCtx.subscriptions.push(
        analyzeDocumentCommand,
        analyzeFileCommand,
        findSuggestionsCommand,
        conceptualRefactorCommand,
        generateUnitTestCommand,
        explainCodeCommand,
        configureModelCommand,
        checkStandardsCommand,
        findDuplicateLogicCommand,
        generateUmlDiagramCommand
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