// src/commands/OllamaCommands.ts

import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { UnifiedResponseWebview } from '../ui/webviews';
import { getExcludePattern } from '../utils/ignoreUtils';
import { I18n } from '../internationalization/i18n'; // <-- Importar

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
    const title = I18n.t('command.analyzeFile.title');
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
            UnifiedResponseWebview.currentPanel.showResponse(I18n.t('error.noValidResponse'));
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : I18n.t('error.unknown');
        if (UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel.showResponse(`${I18n.t('error.duringAnalysis')}: ${errorMessage}`);
        }
    }
}

export function registerOllamaCommands(coreCtx: CoreExtensionContext, vsCodeCtx: vscode.ExtensionContext) {

    const analyzeFileCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.analyzeCurrentFile', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            runAnalysis(editor.document, coreCtx, vsCodeCtx);
        } else {
            vscode.window.showInformationMessage(I18n.t('command.analyzeFile.noFileOpen'));
        }
    });

    const analyzeDocumentCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.analyzeCurrentDocument', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            runAnalysis(editor.document, coreCtx, vsCodeCtx);
        } else {
            vscode.window.showInformationMessage(I18n.t('command.analyzeFile.noFileOpen'));
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
            vscode.window.showErrorMessage(I18n.t('error.noModelConfigured'));
            return;
        }

        UnifiedResponseWebview.createOrShow(vsCodeCtx.extensionUri, loadingTitle);

        try {
            const result = await serviceCall();

            if (UnifiedResponseWebview.currentPanel) {
                if (result && result.response) {
                    UnifiedResponseWebview.currentPanel.showResponse(result.response);
                } else {
                    UnifiedResponseWebview.currentPanel.showResponse(I18n.t('error.noValidResponse'));
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : I18n.t('error.unknown');
            if (UnifiedResponseWebview.currentPanel) {
                UnifiedResponseWebview.currentPanel.showResponse(`${I18n.t('error.executingCommand')}: ${errorMessage}`);
            } else {
                vscode.window.showErrorMessage(`${I18n.t('error.inCommand')}: ${errorMessage}`);
            }
        }
    };
    
    // Comando para generar código desde comentario
    const generateCodeFromCommentCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateCodeFromComment', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage(I18n.t('command.generateCode.noFileOpen'));
            return;
        }

        const position = editor.selection.active;
        const lineText = editor.document.lineAt(position.line).text;

        // [CORRECCIÓN] Extraer la instrucción desde un comentario usando una expresión regular
        const commentRegex = /(?:(?:\/\/+|#|--|;|\/\*+)\s*)(.*)/;
        const match = lineText.match(commentRegex);
        const instruction = match ? match[1].trim() : '';

        if (!instruction) {
            vscode.window.showInformationMessage(I18n.t('command.generateCode.emptyInstruction'));
            return;
        }

        executeCommandWithWebview(I18n.t('command.generateCode.title'), async () => {
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
        executeCommandWithWebview(I18n.t('command.findSuggestions.title'), async () => {
            const prompt = await coreCtx.promptingService.getRefactorPrompt(editor.document.getText(), editor.document.languageId);
            const response = await coreCtx.ollamaService.generate(prompt, vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!);
            return { prompt, response: response?.response ?? null };
        });
    });

    const conceptualRefactorCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.conceptualRefactor', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage(I18n.t('command.conceptualRefactor.noSelection'));
            return;
        }
        executeCommandWithWebview(I18n.t('command.conceptualRefactor.title'), async () => {
            const selectedCode = editor.document.getText(editor.selection);
            const prompt = await coreCtx.promptingService.getConceptualRefactorPrompt(selectedCode, editor.document.languageId);
            const response = await coreCtx.ollamaService.generate(prompt, vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!);
            return { prompt, response: response?.response ?? null };
        });
    });

    const generateUnitTestCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateUnitTest', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage(I18n.t('command.generateUnitTest.noSelection'));
            return;
        }
        executeCommandWithWebview(I18n.t('command.generateUnitTest.title'), async () => {
            const selectedCode = editor.document.getText(editor.selection);
            const prompt = await coreCtx.promptingService.getUnitTestPrompt(selectedCode, editor.document.languageId);
            const response = await coreCtx.ollamaService.generate(prompt, vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!);
            return { prompt, response: response?.response ?? null };
        });
    });

    const explainCodeCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.explainCode', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage(I18n.t('command.explainCode.noSelection'));
            return;
        }
        executeCommandWithWebview(I18n.t('command.explainCode.title'), async () => {
            const selectedCode = editor.document.getText(editor.selection);
            const prompt = await coreCtx.promptingService.getExplainPrompt(selectedCode, editor.document.languageId);
            const response = await coreCtx.ollamaService.generate(prompt, vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!);
            return { prompt, response: response?.response ?? null };
        });
    });

    const checkStandardsCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.checkCompanyStandards', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage(I18n.t('command.checkStandards.noFileOpen'));
            return;
        }
        executeCommandWithWebview(I18n.t('command.checkStandards.title'), async () => {
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
            vscode.window.showInformationMessage(I18n.t('command.findDuplicateLogic.noFileOpen'));
            return;
        }
        executeCommandWithWebview(I18n.t('command.findDuplicateLogic.title'), async () => {
            const code = editor.document.getText();
            const languageId = editor.document.languageId;
            const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!;
            const prompt = await coreCtx.promptingService.getDuplicateDetectionPrompt(code, languageId);
            const response = await coreCtx.ollamaService.generate(prompt, model);
            return { prompt, response: response?.response ?? null };
        });
    });

    const generateUmlDiagramCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateUmlDiagram', async () => {
        const title = I18n.t('command.generateUmlDiagram.title');

        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showInformationMessage(I18n.t('command.generateUmlDiagram.noWorkspace'));
            return;
        }
        
        const analysisRoot = vscode.workspace.workspaceFolders[0].uri;

        const findProjectFiles = async (rootUri: vscode.Uri): Promise<{ path: string, content: string }[]> => {
            const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
            const supportedLanguages = config.get<string[]>('supportedLanguages', []);
            
            const allExtensions = supportedLanguages.flatMap(getExtensionsForLanguage);
            const uniqueExtensions = [...new Set(allExtensions)];

            if (uniqueExtensions.length === 0) {
                return [];
            }

            const includePattern = `**/*{${uniqueExtensions.join(',')}}`;
            const excludePattern = await getExcludePattern(rootUri);
            
            const files = await vscode.workspace.findFiles(includePattern, excludePattern);

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

        // Inicia la webview
        UnifiedResponseWebview.createOrShow(vsCodeCtx.extensionUri, title);
        
        const files = await findProjectFiles(analysisRoot);
        if (files.length === 0) {
            vscode.window.showInformationMessage(I18n.t('command.generateUmlDiagram.noFiles'));
            UnifiedResponseWebview.currentPanel?.showResponse(I18n.t('command.generateUmlDiagram.noFilesToAnalyze'));
            return;
        }

        UnifiedResponseWebview.currentPanel?.showUmlInitialLoading(files.length);

        const projectStructure: any[] = [];
        const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!;
        
        // FASE 1: EXTRACCIÓN
        const allFileStructures: any[] = []; 
        for (const file of files) {
            const structure = await coreCtx.ollamaService.extractUmlStructureFromFile(file, model);
            let componentsFound = I18n.t('command.generateUmlDiagram.analyzing');
            if (structure) {
                // Guardamos el objeto JSON completo del archivo.
                allFileStructures.push(structure); 
                
                if (structure.components && structure.components.length > 0) {
                    componentsFound = structure.components.map((c: any) => `${c.name} (${c.type})`).join(', ');
                } else {
                    componentsFound = I18n.t('command.generateUmlDiagram.noComponents');
                }
            } else {
                componentsFound = I18n.t('command.generateUmlDiagram.cannotAnalyze');
            }
            UnifiedResponseWebview.currentPanel?.showUmlGenerationProgress(file.path, componentsFound);
        }
        
        // FASE 2: SÍNTESIS
        if (allFileStructures.length > 0) {
            const finalUmlContent = await coreCtx.ollamaService.synthesizeUmlDiagram(allFileStructures, model);
            if (finalUmlContent && UnifiedResponseWebview.currentPanel) {
                const finalResponse = `${I18n.t('command.generateUmlDiagram.diagramGenerated')}\n\n\`\`\`plantuml\n${finalUmlContent}\n\`\`\``;
                UnifiedResponseWebview.currentPanel.showResponse(finalResponse, allFileStructures); 
            } else {
                UnifiedResponseWebview.currentPanel?.showResponse(I18n.t('command.generateUmlDiagram.cannotGenerateFinal'), allFileStructures);
            }
        } else {
            UnifiedResponseWebview.currentPanel?.showResponse(I18n.t('command.generateUmlDiagram.noValidStructure'));
        }
    });

    const configureLanguageCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.configureLanguage', _configureLanguage);

    // [NUEVO] Comando para validar estándares de todo el proyecto
    const checkProjectStandardsCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.checkProjectStandards', async () => {
        const title = I18n.t('command.checkProjectStandards.title');
        const rootFolder = vscode.workspace.workspaceFolders?.[0];
        if (!rootFolder) {
            vscode.window.showInformationMessage(I18n.t('command.checkProjectStandards.noWorkspace'));
            return;
        }

        const findProjectFiles = async (rootUri: vscode.Uri): Promise<{ path: string, content: string }[]> => {
            const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
            const supportedLanguages = config.get<string[]>('supportedLanguages', []);
            
            const allExtensions = supportedLanguages.flatMap(getExtensionsForLanguage);
            const uniqueExtensions = [...new Set(allExtensions)];

            if (uniqueExtensions.length === 0) {
                return [];
            }

            const includePattern = `**/*{${uniqueExtensions.join(',')}}`;
            const excludePattern = await getExcludePattern(rootUri);
            
            const files = await vscode.workspace.findFiles(includePattern, excludePattern);

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

        UnifiedResponseWebview.createOrShow(vsCodeCtx.extensionUri, title);
        const files = await findProjectFiles(rootFolder.uri);
        if (files.length === 0) {
            UnifiedResponseWebview.currentPanel?.showResponse(I18n.t('command.checkProjectStandards.noFiles'));
            return;
        }

        UnifiedResponseWebview.currentPanel?.showUmlInitialLoading(files.length); // Reutilizamos la vista de carga de UML

        const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!;
        let finalReport = `# ${I18n.t('command.checkProjectStandards.reportTitle')}\n\n`;

        for (const file of files) {
            const prompt = await coreCtx.promptingService.getStandardsPrompt(file.content, vscode.workspace.asRelativePath(file.path));
            const result = await coreCtx.ollamaService.generate(prompt, model);
            const response = result?.response ?? I18n.t('command.checkProjectStandards.noResponse');
            
            finalReport += `## ${I18n.t('command.checkProjectStandards.fileLabel')}: ${file.path}\n\n${response}\n\n---\n\n`;
            
            // Actualizamos el progreso en la vista
            UnifiedResponseWebview.currentPanel?.showUmlGenerationProgress(file.path, I18n.t('command.checkProjectStandards.analyzed'));
        }

        UnifiedResponseWebview.currentPanel?.showResponse(finalReport);
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
        generateCodeFromCommentCommand,
        configureLanguageCommand,
        checkProjectStandardsCommand
    );
}

// [NUEVA] Función auxiliar para configurar el idioma
async function _configureLanguage() {
    const selectedLanguage = await vscode.window.showQuickPick(['Español', 'English'], {
        placeHolder: I18n.t('command.configureLanguage.placeholder'),
        title: I18n.t('command.configureLanguage.title')
    });

    if (selectedLanguage) {
        await vscode.workspace.getConfiguration('ollamaCodeAnalyzer').update('outputLanguage', selectedLanguage, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`${I18n.t('command.configureLanguage.success')}: ${selectedLanguage}`);
    }
}

async function _configureModel(coreCtx: CoreExtensionContext) {
    const { ollamaService } = coreCtx;
    try {
        const models = await ollamaService.getModels();
        if (!models || models.length === 0) {
            vscode.window.showWarningMessage(I18n.t('command.configureModel.noModels'));
            return;
        }

        const modelItems = models.map(m => ({
            label: m.name,
            description: `${I18n.t('command.configureModel.family')}: ${m.details.family}`
        }));

        const selectedModel = await vscode.window.showQuickPick(modelItems, {
            placeHolder: I18n.t('command.configureModel.placeholder'),
            title: I18n.t('command.configureModel.title')
        });

        if (selectedModel) {
            await vscode.workspace.getConfiguration('ollamaCodeAnalyzer').update('model', selectedModel.label, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`${I18n.t('command.configureModel.success')}: ${selectedModel.label}`);
        }
    } catch (e) {
        vscode.window.showErrorMessage(`${I18n.t('command.configureModel.error')}: ${e instanceof Error ? e.message : I18n.t('error.unknown')}`);
    }
}