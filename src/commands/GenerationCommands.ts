/**
 * @file Registra los comandos de generación de código.
 * Proporciona funcionalidades para generar código a partir de comentarios
 * y para crear pruebas unitarias para el código seleccionado.
 */
// src/commands/GenerationCommands.ts - Comandos de generación
import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { I18n } from '../internationalization/i18n';
import { executeCommandWithWebview } from './utils/CommandUtils';

export function registerGenerationCommands(coreCtx: CoreExtensionContext, vsCodeCtx: vscode.ExtensionContext) {
    const generateCodeFromCommentCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateCodeFromComment', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage(I18n.t('command.generateCode.noFileOpen'));
            return;
        }

        const position = editor.selection.active;
        const lineText = editor.document.lineAt(position.line).text;

        const commentRegex = /(?:(?:\/\/+|#|--|;|\/\*+)\s*)(.*)/;
        const match = lineText.match(commentRegex);
        const instruction = match ? match[1].trim() : '';

        if (!instruction) {
            vscode.window.showInformationMessage(I18n.t('command.generateCode.emptyInstruction'));
            return;
        }

        executeCommandWithWebview(vsCodeCtx, 'command.generateCodeFromComment.title', async () => { // <-- CAMBIO: Clave de i18n
            const languageId = editor.document.languageId;
            const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!;

            const prompt = await coreCtx.promptingService.getGenerationPrompt(instruction, languageId);
            const result = await coreCtx.ollamaService.generate(prompt, model);
            
            return { prompt, response: result?.response ?? null };
        });
    });

    const generateUnitTestCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateUnitTest', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage(I18n.t('command.generateUnitTest.noSelection'));
            return;
        }
        executeCommandWithWebview(vsCodeCtx, 'command.generateUnitTest.title', async () => { // <-- CAMBIO: Clave de i18n
            const selectedCode = editor.document.getText(editor.selection);
            const prompt = await coreCtx.promptingService.getUnitTestPrompt(selectedCode, editor.document.languageId);
            const response = await coreCtx.ollamaService.generate(prompt, vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!);
            return { prompt, response: response?.response ?? null };
        });
    });

    vsCodeCtx.subscriptions.push(
        generateCodeFromCommentCommand,
        generateUnitTestCommand
    );
}