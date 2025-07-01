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

     // Comando para generar código desde un comentario
    const generateCodeCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateCodeFromComment', () => {
        generateCodeFromComment(services);
    });

     const conceptualRefactorCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.conceptualRefactor', () => {
        runConceptualRefactor(services);
    });



    context.subscriptions.push(analyzeFileCommand, analyzeWithGemmaCommand,generateCodeCommand,conceptualRefactorCommand);
}

/**
 * Realiza una refactorización conceptual del código seleccionado.
 */
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
    const model = config.get<string>('model', 'codellama');

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


/**
 * Genera código a partir de un comentario especial en el editor.
 * @param services Los servicios de la extensión.
 */
async function generateCodeFromComment(services: ExtensionServices) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage("Abre un archivo y coloca el cursor en la línea del comentario para generar código.");
        return;
    }

    const position = editor.selection.active;
    const line = editor.document.lineAt(position.line);
    const commentPrefix = '///';

    // Verificar si la línea empieza con el prefijo especial
    if (!line.text.trim().startsWith(commentPrefix)) {
        vscode.window.showErrorMessage("Coloca el cursor en una línea que empiece con '///' seguido de tu instrucción.");
        return;
    }

    // Extraer la instrucción
    const instruction = line.text.trim().substring(commentPrefix.length).trim();
    if (!instruction) {
        vscode.window.showInformationMessage("Escribe una instrucción después de '///'.");
        return;
    }

    const { ollamaService } = services;
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const model = config.get<string>('model', 'codellama');
    const language = editor.document.languageId;

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generando código con Ollama...",
        cancellable: false
    }, async (progress) => {
        // Usamos el nuevo método del servicio
        const generatedCode = await ollamaService.generateCode(instruction, language, model);

        if (generatedCode) {
            // Insertar el código generado debajo de la línea del comentario
            editor.edit(editBuilder => {
                // Añadimos un salto de línea inicial para separar del comentario
                const codeToInsert = `\n${generatedCode}`;
                editBuilder.insert(new vscode.Position(position.line + 1, 0), codeToInsert);
            });
            vscode.window.showInformationMessage("¡Código generado e insertado!");
        }
    });
}