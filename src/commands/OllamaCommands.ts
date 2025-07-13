// src/commands/ollama.ts

import * as vscode from 'vscode';
import { getRelativeFilePath } from '../utils/pathUtils';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { AnalysisReportWebview } from '../ui/webviews';

/**
 * Registra todos los comandos relacionados con Ollama.
 * @param coreCtx El contexto central de la extensión que contiene todos los servicios.
 * @param vsCodeCtx El contexto de la extensión de VS Code para las suscripciones.
 */
export function registerOllamaCommands(coreCtx: CoreExtensionContext, vsCodeCtx: vscode.ExtensionContext) {
    
    // --- Comandos de Análisis y Refactorización ---
    const analyzeFileCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.analyzeCurrentFile', 
        () => runAnalysis(vscode.window.activeTextEditor?.document, coreCtx));
    
    const findSuggestionsCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.findSuggestions', 
        () => _findSuggestions(coreCtx));

    const conceptualRefactorCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.conceptualRefactor', 
        () => _runConceptualRefactor(coreCtx));

    const checkCompanyStandardsCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.checkCompanyStandards', 
        () => _checkCompanyStandards(coreCtx));

    const findDuplicateLogicCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.findDuplicateLogic', 
        () => _findDuplicateLogic(coreCtx));

    // --- Comandos de Generación y Explicación de Código ---
    const generateCodeCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateCodeFromComment', 
        () => _generateCodeFromComment(coreCtx));

    const generateUnitTestCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateUnitTest', 
        () => _generateUnitTest(coreCtx));

    const explainCodeCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.explainCode', 
        () => _explainCode(coreCtx));
        
    const generateUmlDiagramCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateUmlDiagram', 
        () => _generateUmlDiagram(coreCtx));

    // --- Comandos de UI y Utilidad ---
    const showAnalysisReportCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.showAnalysisReport', 
        () => _showAnalysisReport(coreCtx, vsCodeCtx.extensionUri));

    const showRecommendedModelsCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.showRecommendedModels', 
        () => _showRecommendedModels(coreCtx));

    // Añadir todos los comandos a las suscripciones para que se gestionen correctamente
    vsCodeCtx.subscriptions.push(
        analyzeFileCommand,
        findSuggestionsCommand,
        conceptualRefactorCommand,
        checkCompanyStandardsCommand,
        findDuplicateLogicCommand,
        generateCodeCommand,
        generateUnitTestCommand,
        explainCodeCommand,
        generateUmlDiagramCommand,
        showAnalysisReportCommand,
        showRecommendedModelsCommand
    );
}

// =====================================================================================
// --- Lógica de Implementación de Comandos (Funciones Privadas) ---
// =====================================================================================

// =====================================================================================
// --- Funciones de Utilidad Exportadas ---
// =====================================================================================

/**
 * Exportamos esta función para que pueda ser utilizada por los listeners de eventos.
 * Ejecuta el análisis principal del documento, decidiendo si usar contexto de Git o no.
 */
export async function runAnalysis(document: vscode.TextDocument | undefined, coreCtx: CoreExtensionContext) {
    if (!document) {
        vscode.window.showInformationMessage("Por favor, abre un archivo para analizar.");
        return;
    }

    const { codeAnalyzer, gitContextAnalyzer, giteaService, gitContextProvider } = coreCtx;
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const useGitContext = config.get<boolean>('gitea.useContextualAnalysis', true);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Analizando con Ollama...",
        cancellable: true
    }, async (progress, token) => {
        console.log(`[OllamaCommands] Iniciando análisis para: ${document.uri.fsPath}`);
        
        if (useGitContext && await giteaService.isConfigured()) {
            console.log('[OllamaCommands] Usando análisis con contexto de Gitea.');
            await gitContextAnalyzer.analyzeFileWithGitContext(document);
            const relativePath = getRelativeFilePath(document.uri);
            if (relativePath && !token.isCancellationRequested) {
                gitContextProvider.refresh(relativePath);
            }
        } else {
            console.log('[OllamaCommands] Usando análisis de documento estándar.');
            await codeAnalyzer.analyzeDocument(document);
        }
    });
}
/**
 * Busca y muestra sugerencias de refactorización como diagnósticos en el editor.
 */
async function _findSuggestions(coreCtx: CoreExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Buscando sugerencias con Ollama...',
    }, () => coreCtx.refactorProvider.updateDiagnostics(editor.document));
}

/**
 * Ofrece una refactorización conceptual del código seleccionado.
 */
async function _runConceptualRefactor(coreCtx: CoreExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
        vscode.window.showInformationMessage("Por favor, selecciona el bloque de código que quieres refactorizar.");
        return;
    }

    const selection = editor.selection;
    const selectedCode = editor.document.getText(selection);
    const language = editor.document.languageId;
    const { ollamaService } = coreCtx;
    const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model');

    if (!model) {
        vscode.window.showErrorMessage("No se ha configurado un modelo de Ollama en los ajustes.");
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Ollama está pensando en una refactorización...",
        cancellable: true
    }, async (progress, token) => {
        const result = await ollamaService.getConceptualRefactoring(selectedCode, language, model);
        if (token.isCancellationRequested || !result) {
            if (!token.isCancellationRequested) {
                vscode.window.showErrorMessage("Ollama no pudo generar una sugerencia de refactorización.");
            }
            return;
        }

        const choice = await vscode.window.showInformationMessage(
            `Ollama sugiere un cambio. Intención detectada: "${result.intent}"`,
            { modal: true, detail: `Explicación: ${result.explanation}` },
            'Aplicar Refactorización'
        );

        if (choice === 'Aplicar Refactorización') {
            editor.edit(editBuilder => editBuilder.replace(selection, result.suggestion));
        }
    });
}

/**
 * Genera código a partir de un comentario especial (///).
 */
async function _generateCodeFromComment(coreCtx: CoreExtensionContext) {
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

    const { ollamaService } = coreCtx;
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const model = config.get<string>('model');
    if (!model) {
        vscode.window.showErrorMessage("No se ha configurado un modelo de Ollama.");
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generando código con Ollama...",
        cancellable: false
    }, async () => {
        const generatedCode = await ollamaService.generateCode(instruction, editor.document.languageId, model);
        if (generatedCode) {
            editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(position.line + 1, 0), `\n${generatedCode}`);
            });
            vscode.window.showInformationMessage("¡Código generado e insertado!");
        }
    });
}

/**
 * Muestra una Webview con el informe del análisis.
 */
async function _showAnalysisReport(coreCtx: CoreExtensionContext, extensionUri: vscode.Uri) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage("Abre un archivo para poder mostrar un informe de análisis.");
        return;
    }
    const result = await coreCtx.codeAnalyzer.analyzeDocument(editor.document);
    AnalysisReportWebview.createOrShow(extensionUri);

    if (result && AnalysisReportWebview.currentPanel) {
        AnalysisReportWebview.currentPanel.update(result);
    }
}

/**
 * Muestra la lista de modelos de Ollama disponibles.
 */
async function _showRecommendedModels(coreCtx: CoreExtensionContext) {
    const { ollamaService } = coreCtx;
    const models = await ollamaService.getModels();
    const modelNames = models.map(m => m.name);
    vscode.window.showQuickPick(modelNames, {
        placeHolder: 'Modelos de Ollama disponibles'
    });
}

/**
 * Explica el fragmento de código seleccionado.
 */
async function _explainCode(coreCtx: CoreExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
        vscode.window.showInformationMessage("Por favor, selecciona el código que quieres explicar.");
        return;
    }
    const selectedCode = editor.document.getText(editor.selection);
    const language = editor.document.languageId;
    const { ollamaService } = coreCtx;
    const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model');

    if (!model) return;

    const explanation = await ollamaService.getExplanation(selectedCode, language, model);
    if (explanation) {
        vscode.window.showInformationMessage("Explicación del Código:", { modal: true, detail: explanation });
    }
}

/**
 * Genera un test unitario para el código seleccionado.
 */
async function _generateUnitTest(coreCtx: CoreExtensionContext) {
    const editor = vscode.window.activeTextEditor;
     if (!editor || editor.selection.isEmpty) {
        vscode.window.showInformationMessage("Por favor, selecciona el código para el que quieres generar una prueba unitaria.");
        return;
    }
    const selectedCode = editor.document.getText(editor.selection);
    const language = editor.document.languageId;
    const { ollamaService } = coreCtx;
    const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model', 'codellama');

    const test = await ollamaService.generateUnitTest(selectedCode, language, model);
    if (test) {
        const newDocument = await vscode.workspace.openTextDocument({
            content: test,
            language: language
        });
        vscode.window.showTextDocument(newDocument);
    }
}

/**
 * Valida el código contra estándares de la empresa (definidos en prompts).
 */
async function _checkCompanyStandards(coreCtx: CoreExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const { ollamaService } = coreCtx;
    const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model', 'codellama');
    
    const violations = await ollamaService.validateStandards(editor.document.getText(), editor.document.languageId, model);
    if (violations) {
        vscode.window.showWarningMessage("Violaciones de Estándares:", { modal: true, detail: violations });
    } else {
        vscode.window.showInformationMessage("El código cumple con los estándares de la empresa.");
    }
}

/**
 * Busca lógica duplicada en el archivo actual.
 */
async function _findDuplicateLogic(coreCtx: CoreExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    
    const { ollamaService } = coreCtx;
    const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model', 'codellama');

    const duplicates = await ollamaService.findDuplicateLogic(editor.document.getText(), editor.document.languageId, model);
    if (duplicates) {
        vscode.window.showWarningMessage("Lógica Duplicada Encontrada:", { modal: true, detail: duplicates });
    } else {
        vscode.window.showInformationMessage("No se encontró lógica duplicada en el archivo.");
    }
}

/**
 * Genera un diagrama UML (PlantUML) para el proyecto.
 */
async function _generateUmlDiagram(coreCtx: CoreExtensionContext) {
    const { ollamaService } = coreCtx;
    const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model', 'codellama');

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generando diagrama UML...",
        cancellable: true
    }, async (progress, token) => {
        const filesUri = await vscode.workspace.findFiles('src/**/*.ts', '**/node_modules/**');
        if (token.isCancellationRequested || filesUri.length === 0) return;

        progress.report({ message: `Leyendo ${filesUri.length} archivos...` });
        const fileContents = await Promise.all(
            filesUri.map(async uri => ({
                path: vscode.workspace.asRelativePath(uri),
                content: (await vscode.workspace.openTextDocument(uri)).getText()
            }))
        );

        if (token.isCancellationRequested) return;

        progress.report({ message: 'Generando diagrama con Ollama...', increment: 50 });
        const umlCode = await ollamaService.generateUmlDiagram(fileContents, model);
        
        if (umlCode && !token.isCancellationRequested) {
            const newDocument = await vscode.workspace.openTextDocument({ content: umlCode, language: 'plantuml' });
            vscode.window.showTextDocument(newDocument);
            vscode.window.showInformationMessage("¡Diagrama PlantUML generado!");
        } else if (!token.isCancellationRequested) {
            vscode.window.showErrorMessage("Ollama no pudo generar el diagrama UML.");
        }
    });
}