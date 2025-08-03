/**
 * @file Registra los comandos relacionados con el análisis de código.
 * Incluye comandos para analizar el documento actual, encontrar sugerencias de
 * refactorización, explicar código y validar estándares.
 */

import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { UnifiedResponseWebview } from '../ui/webviews';
import { I18n } from '../internationalization/i18n';
import { executeCommandWithWebview } from './utils/CommandUtils';
import { Logger } from '../utils/logger';

export async function runAnalysis(
    document: vscode.TextDocument,
    coreCtx: CoreExtensionContext,
    vsCodeCtx: vscode.ExtensionContext
) {
    Logger.show();
    Logger.log(`Ejecutando análisis para: ${document.uri.fsPath}`);
    const title = I18n.t('command.analyzeCurrentDocument.title'); // <-- CAMBIO: Resolvemos el título aquí
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
         Logger.error(`Error durante el análisis:`, error);
        Logger.show();
    }
}

export function registerAnalysisCommands(coreCtx: CoreExtensionContext, vsCodeCtx: vscode.ExtensionContext) {
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

    const findSuggestionsCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.findSuggestions', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {return;}
        executeCommandWithWebview(vsCodeCtx, 'command.findSuggestions.title', async () => { // <-- CAMBIO: Clave de i18n
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
        executeCommandWithWebview(vsCodeCtx, 'command.conceptualRefactor.title', async () => { // <-- CAMBIO: Clave de i18n
            const selectedCode = editor.document.getText(editor.selection);
            const prompt = await coreCtx.promptingService.getConceptualRefactorPrompt(selectedCode, editor.document.languageId);
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
        executeCommandWithWebview(vsCodeCtx, 'command.explainCode.title', async () => { // <-- CAMBIO: Clave de i18n
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
        executeCommandWithWebview(vsCodeCtx, 'command.checkCompanyStandards.title', async () => { // <-- CAMBIO: Clave de i18n
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
        executeCommandWithWebview(vsCodeCtx, 'command.findDuplicateLogic.title', async () => { // <-- CAMBIO: Clave de i18n
            const code = editor.document.getText();
            const languageId = editor.document.languageId;
            const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!;
            const prompt = await coreCtx.promptingService.getDuplicateDetectionPrompt(code, languageId);
            const response = await coreCtx.ollamaService.generate(prompt, model);
            return { prompt, response: response?.response ?? null };
        });
    });

    vsCodeCtx.subscriptions.push(
        analyzeFileCommand,
        analyzeDocumentCommand,
        findSuggestionsCommand,
        conceptualRefactorCommand,
        explainCodeCommand,
        checkStandardsCommand,
        findDuplicateLogicCommand
    );
}