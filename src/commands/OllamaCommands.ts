// src/commands/OllamaCommands.ts

import * as vscode from 'vscode';
import { ExtensionServices } from '../extension';
import { getRelativeFilePath } from '../utils/pathUtils';


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
    const analyzeFileCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.analyzeCurrentFile', () => {
        runAnalysis(vscode.window.activeTextEditor?.document, services);
    });

    const analyzeWithGemmaCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.analyzeWithGemma', () => {
        runAnalysis(vscode.window.activeTextEditor?.document, services);
    });

    const generateCodeCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateCodeFromComment', () => {
        generateCodeFromComment(services);
    });

    const conceptualRefactorCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.conceptualRefactor', () => {
        runConceptualRefactor(services);
    });

    const showRecommendedModelsCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.showRecommendedModels', () => {
        showRecommendedModels(services);
    });

    const explainCodeCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.explainCode', () => {
        explainCode(services);
    });

    const generateUnitTestCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateUnitTest', () => {
        generateUnitTest(services);
    });

    const checkCompanyStandardsCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.checkCompanyStandards', () => {
        checkCompanyStandards(services);
    });

    const findDuplicateLogicCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.findDuplicateLogic', () => {
        findDuplicateLogic(services);
    });
    
    const generateUmlDiagramCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateUmlDiagram', () => {
        generateUmlDiagram(services);
    });


    context.subscriptions.push(
        analyzeFileCommand, 
        analyzeWithGemmaCommand,
        generateCodeCommand,
        conceptualRefactorCommand,
        showRecommendedModelsCommand,
        explainCodeCommand,
        generateUnitTestCommand,
        checkCompanyStandardsCommand,
        findDuplicateLogicCommand,
        generateUmlDiagramCommand

    );
}


async function runConceptualRefactor(services: ExtensionServices) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
        vscode.window.showInformationMessage("Por favor, selecciona el bloque de código que quieres refactorizar.");
        return;
    }

    const selection = editor.selection;
    const selectedCode = editor.document.getText(selection);
    const language = editor.document.languageId;

    const { ollamaService } = services;
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    // [CORREGIDO] Se elimina el fallback para usar el default de package.json
    const model = config.get<string>('model');

    if (!model) {
        vscode.window.showErrorMessage("No se ha configurado un modelo de Ollama en los ajustes.");
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Ollama está pensando en una refactorización...",
        cancellable: true
    }, async (progress, token) => {
        const result = await ollamaService.getConceptualRefactoring(selectedCode, language, model);

        if (token.isCancellationRequested) return;

        if (result) {
            const userChoice = await vscode.window.showInformationMessage(
                `Ollama sugiere un cambio. Intención detectada: "${result.intent}"`,
                { modal: true, detail: `Explicación: ${result.explanation}` },
                'Aplicar Refactorización', 'Cancelar'
            );

            if (userChoice === 'Aplicar Refactorización') {
                editor.edit(editBuilder => {
                    editBuilder.replace(selection, result.suggestion);
                });
            }
        } else {
            vscode.window.showErrorMessage("Ollama no pudo generar una sugerencia de refactorización.");
        }
    });
}


async function generateCodeFromComment(services: ExtensionServices) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage("Abre un archivo y coloca el cursor en la línea del comentario para generar código.");
        return;
    }

    const position = editor.selection.active;
    const line = editor.document.lineAt(position.line);
    const commentPrefix = '///';

    if (!line.text.trim().startsWith(commentPrefix)) {
        vscode.window.showErrorMessage("Coloca el cursor en una línea que empiece con '///' seguido de tu instrucción.");
        return;
    }

    const instruction = line.text.trim().substring(commentPrefix.length).trim();
    if (!instruction) {
        vscode.window.showInformationMessage("Escribe una instrucción después de '///'.");
        return;
    }

    const { ollamaService } = services;
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    // [CORREGIDO] Se elimina el fallback
    const model = config.get<string>('model');
    const language = editor.document.languageId;

    if (!model) {
        vscode.window.showErrorMessage("No se ha configurado un modelo de Ollama en los ajustes.");
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generando código con Ollama...",
        cancellable: false
    }, async (progress) => {
        const generatedCode = await ollamaService.generateCode(instruction, language, model);

        if (generatedCode) {
            editor.edit(editBuilder => {
                const codeToInsert = `\n${generatedCode}`;
                editBuilder.insert(new vscode.Position(position.line + 1, 0), codeToInsert);
            });
            vscode.window.showInformationMessage("¡Código generado e insertado!");
        }
    });
}

async function generateUmlDiagram(services: ExtensionServices) {
    const { ollamaService } = services;
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const model = config.get<string>('model', 'codellama');

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Analizando archivos para generar diagrama UML...",
        cancellable: true
    }, async (progress, token) => {
        // Encuentra todos los archivos relevantes (ej. TypeScript)
        const filesUri = await vscode.workspace.findFiles('src/**/*.ts', '**/node_modules/**');
        
        if (token.isCancellationRequested) return;

        if (filesUri.length === 0) {
            vscode.window.showInformationMessage("No se encontraron archivos TypeScript en la carpeta 'src' para generar el diagrama.");
            return;
        }

        progress.report({ message: `Leyendo ${filesUri.length} archivos...` });

        const fileContents = await Promise.all(
            filesUri.map(async uri => {
                const document = await vscode.workspace.openTextDocument(uri);
                return {
                    path: vscode.workspace.asRelativePath(uri),
                    content: document.getText()
                };
            })
        );
        
        if (token.isCancellationRequested) return;

        progress.report({ message: 'Generando diagrama con Ollama...', increment: 50 });

        const umlCode = await ollamaService.generateUmlDiagram(fileContents, model);

        if (token.isCancellationRequested) return;

        if (umlCode) {
            const newDocument = await vscode.workspace.openTextDocument({
                content: umlCode,
                language: 'plantuml' // Asume que el usuario tiene una extensión de PlantUML
            });
            vscode.window.showTextDocument(newDocument);
            vscode.window.showInformationMessage("¡Diagrama PlantUML generado!");
        } else {
            vscode.window.showErrorMessage("Ollama no pudo generar el diagrama UML.");
        }
    });
}


async function showRecommendedModels(services: ExtensionServices) {
    const { ollamaService } = services;
    const models = await ollamaService.getModels();
    const modelNames = models.map(m => m.name);
    vscode.window.showQuickPick(modelNames, {
        placeHolder: 'Modelos de Ollama disponibles'
    });
}


async function explainCode(services: ExtensionServices) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
        vscode.window.showInformationMessage("Por favor, selecciona el código que quieres explicar.");
        return;
    }
    const selectedCode = editor.document.getText(editor.selection);
    const language = editor.document.languageId;
    const { ollamaService } = services;
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    // [CORREGIDO] Se elimina el fallback
    const model = config.get<string>('model');

    if (!model) {
        vscode.window.showErrorMessage("No se ha configurado un modelo de Ollama en los ajustes.");
        return;
    }

    const explanation = await ollamaService.getExplanation(selectedCode, language, model);
    if (explanation) {
        vscode.window.showInformationMessage("Explicación del Código:", { modal: true, detail: explanation });
    }
}


async function generateUnitTest(services: ExtensionServices) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
        vscode.window.showInformationMessage("Por favor, selecciona el código para el que quieres generar una prueba unitaria.");
        return;
    }
    const selectedCode = editor.document.getText(editor.selection);
    const language = editor.document.languageId;
    const { ollamaService } = services;
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const model = config.get<string>('model', 'codellama');

    const test = await ollamaService.generateUnitTest(selectedCode, language, model);
    if (test) {
        const newDocument = await vscode.workspace.openTextDocument({
            content: test,
            language: language
        });
        vscode.window.showTextDocument(newDocument);
    }
}

async function checkCompanyStandards(services: ExtensionServices) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const { ollamaService } = services;
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const model = config.get<string>('model', 'codellama');

    const violations = await ollamaService.validateStandards(document.getText(), document.languageId, model);
    if (violations) {
        vscode.window.showWarningMessage("Violaciones de Estándares:", { modal: true, detail: violations });
    } else {
        vscode.window.showInformationMessage("El código cumple con los estándares de la empresa.");
    }
}

async function findDuplicateLogic(services: ExtensionServices) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const { ollamaService } = services;
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const model = config.get<string>('model', 'codellama');

    const duplicates = await ollamaService.findDuplicateLogic(document.getText(), document.languageId, model);
    if (duplicates) {
        vscode.window.showWarningMessage("Lógica Duplicada Encontrada:", { modal: true, detail: duplicates });
    } else {
        vscode.window.showInformationMessage("No se encontró lógica duplicada en el archivo.");
    }
}