// src/commands/OllamaCommands.ts

import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { UnifiedResponseWebview } from '../ui/webviews';
import { getRelativeFilePath } from '../utils/pathUtils';

// Función para mapear IDs de lenguaje a extensiones de archivo
function getExtensionsForLanguage(languageId: string): string[] {
    const languageExtensionMap: Record<string, string[]> = {
        'csharp': ['.cs'],
        'javascript': ['.js', '.jsx'],
        'typescript': ['.ts', '.tsx'],
        'python': ['.py'],
        'java': ['.java'],
        'cpp': ['.cpp', '.hpp', '.h'],
        'c': ['.c', '.h'],
        'sql': ['.sql']
    };
    return languageExtensionMap[languageId] || [`.${languageId}`]; // Fallback
}

export async function runAnalysis(
    document: vscode.TextDocument,
    coreCtx: CoreExtensionContext,
    vsCodeCtx: vscode.ExtensionContext
) {
    const title = 'Análisis de Código con Ollama';
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const model = config.get<string>('model');

    if (!model) {
        console.error("Ollama: No se ha configurado un modelo.");
        return;
    }

    UnifiedResponseWebview.createOrShow(vsCodeCtx.extensionUri, title);
    UnifiedResponseWebview.currentPanel?.showLoading();

    try {
        const prompt = await coreCtx.promptingService.getAnalysisPrompt(document.getText(), document.languageId);
        const result = await coreCtx.ollamaService.generate(prompt, model);

        if (result && result.response && UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel.showResponse(result.response);
        } else if (UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel.showResponse("Ollama no devolvió una respuesta válida.");
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        if (UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel.showResponse(`Error durante el análisis: ${errorMessage}`);
        }
    }
}

export function registerOllamaCommands(coreCtx: CoreExtensionContext, vsCodeCtx: vscode.ExtensionContext) {

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
            runAnalysis(editor.document, coreCtx, vsCodeCtx);
        } else {
            vscode.window.showInformationMessage("Por favor, abre un archivo para analizar.");
        }
    });

    const configureModelCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.configureModel',
        () => _configureModel(coreCtx));

    const executeCommandWithWebview = async (
        loadingTitle: string,
        serviceCall: () => Promise<{ prompt: string, response: string | null } | null>
    ) => {
        const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
        const model = config.get<string>('model');

        if (!model) {
            vscode.window.showErrorMessage("No se ha configurado un modelo de Ollama en los ajustes.");
            return;
        }

        UnifiedResponseWebview.createOrShow(vsCodeCtx.extensionUri, loadingTitle);

        try {
            const result = await serviceCall();

            if (UnifiedResponseWebview.currentPanel) {
                if (result && result.response) {
                    UnifiedResponseWebview.currentPanel.showResponse(result.response);
                } else {
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
    
    // Comando para generar código desde comentario
    const generateCodeFromCommentCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateCodeFromComment', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("Por favor, abre un archivo para usar esta función.");
            return;
        }

        const position = editor.selection.active;
        const lineText = editor.document.lineAt(position.line).text;

        // [CORRECCIÓN] Extraer la instrucción desde un comentario usando una expresión regular
        const commentRegex = /(?:(?:\/\/+|#|--|;|\/\*+)\s*)(.*)/;
        const match = lineText.match(commentRegex);
        const instruction = match ? match[1].trim() : '';

        if (!instruction) {
            vscode.window.showInformationMessage('La instrucción de generación está vacía.');
            return;
        }


        executeCommandWithWebview('Generación de Código desde Comentario', async () => {
            const languageId = editor.document.languageId;
            const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!;

            const prompt = await coreCtx.promptingService.getGenerationPrompt(instruction, languageId);
            const result = await coreCtx.ollamaService.generate(prompt, model);
            
            return { prompt, response: result?.response ?? null };
        });
    });

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
            const prompt = await coreCtx.promptingService.getDuplicateDetectionPrompt(code, languageId);
            const response = await coreCtx.ollamaService.generate(prompt, model);
            return { prompt, response: response?.response ?? null };
        });
    });

    const generateUmlDiagramCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateUmlDiagram', async () => {
        const title = 'Generación de Diagrama UML';

        const rootFolderUri = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: 'Seleccionar Carpeta para Analizar'
        });

        if (!rootFolderUri || rootFolderUri.length === 0) {
            return;
        }
        const analysisRoot = rootFolderUri[0];

        const findProjectFiles = async (rootUri: vscode.Uri): Promise<{ path: string, content: string }[]> => {
            const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
            const supportedLanguages = config.get<string[]>('supportedLanguages', []);
            
            const allExtensions = supportedLanguages.flatMap(getExtensionsForLanguage);
            const uniqueExtensions = [...new Set(allExtensions)];

            if (uniqueExtensions.length === 0) {
                return [];
            }

            const searchPattern = new vscode.RelativePattern(rootUri, `**/*{${uniqueExtensions.join(',')}}`);
            
            const files = await vscode.workspace.findFiles(searchPattern, '**/node_modules/**');

            const fileContents = await Promise.all(
                files.map(async (uri) => {
                    const document = await vscode.workspace.openTextDocument(uri);
                    const relativePath = vscode.workspace.asRelativePath(uri, false);
                    return {
                        path: relativePath,
                        content: document.getText()
                    };
                })
            );
            return fileContents;
        };

        await executeCommandWithWebview(title, async () => {
            const files = await findProjectFiles(analysisRoot);
            if (files.length === 0) {
                vscode.window.showInformationMessage("No se encontraron archivos de código soportados en la carpeta seleccionada. Revisa la configuración 'supportedLanguages'.");
                return { prompt: "", response: "No se encontraron archivos para analizar." };
            }

            const response = await coreCtx.ollamaService.generateUmlDiagram(files, vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!);
            const wrappedResponse = response ? `\`\`\`plantuml\n${response}\n\`\`\`` : "No se pudo generar el diagrama.";
            return { prompt: "UML Generation", response: wrappedResponse };
        });
    });


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
        generateUmlDiagramCommand,
        generateCodeFromCommentCommand
    );
}

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