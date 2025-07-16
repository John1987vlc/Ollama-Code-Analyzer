// src/commands/ProjectCommands.ts - Comandos de proyecto
import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { UnifiedResponseWebview } from '../ui/webviews';
import { I18n } from '../internationalization/i18n';
import { getExcludePattern } from '../utils/ignoreUtils';
import { getExtensionsForLanguage, findProjectFiles } from './utils/ProjectUtils';

export function registerProjectCommands(coreCtx: CoreExtensionContext, vsCodeCtx: vscode.ExtensionContext) {
    const generateUmlDiagramCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.generateUmlDiagram', async () => {
        const title = I18n.t('command.generateUmlDiagram.title');

        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showInformationMessage(I18n.t('command.generateUmlDiagram.noWorkspace'));
            return;
        }
        
        const analysisRoot = vscode.workspace.workspaceFolders[0].uri;

        UnifiedResponseWebview.createOrShow(vsCodeCtx.extensionUri, title);
        
        const files = await findProjectFiles(analysisRoot);
        if (files.length === 0) {
            vscode.window.showInformationMessage(I18n.t('command.generateUmlDiagram.noFiles'));
            UnifiedResponseWebview.currentPanel?.showResponse(I18n.t('command.generateUmlDiagram.noFilesToAnalyze'));
            return;
        }

        UnifiedResponseWebview.currentPanel?.showUmlInitialLoading(files.length);

        const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!;
        
        // FASE 1: EXTRACCIÓN
        const allFileStructures: any[] = []; 
        for (const file of files) {
            const structure = await coreCtx.ollamaService.extractUmlStructureFromFile(file, model);
            let componentsFound = I18n.t('command.generateUmlDiagram.analyzing');
            if (structure) {
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

    const checkProjectStandardsCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.checkProjectStandards', async () => {
        const title = I18n.t('command.checkProjectStandards.title');
        const rootFolder = vscode.workspace.workspaceFolders?.[0];
        if (!rootFolder) {
            vscode.window.showInformationMessage(I18n.t('command.checkProjectStandards.noWorkspace'));
            return;
        }

        UnifiedResponseWebview.createOrShow(vsCodeCtx.extensionUri, title);
        const files = await findProjectFiles(rootFolder.uri);
        if (files.length === 0) {
            UnifiedResponseWebview.currentPanel?.showResponse(I18n.t('command.checkProjectStandards.noFiles'));
            return;
        }

        UnifiedResponseWebview.currentPanel?.showUmlInitialLoading(files.length);

        const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!;
        let finalReport = `# ${I18n.t('command.checkProjectStandards.reportTitle')}\n\n`;

        for (const file of files) {
            const prompt = await coreCtx.promptingService.getStandardsPrompt(file.content, vscode.workspace.asRelativePath(file.path));
            const result = await coreCtx.ollamaService.generate(prompt, model);
            const response = result?.response ?? I18n.t('command.checkProjectStandards.noResponse');
            
            finalReport += `## ${I18n.t('command.checkProjectStandards.fileLabel')}: ${file.path}\n\n${response}\n\n---\n\n`;
            
            UnifiedResponseWebview.currentPanel?.showUmlGenerationProgress(file.path, I18n.t('command.checkProjectStandards.analyzed'));
        }

        UnifiedResponseWebview.currentPanel?.showResponse(finalReport);
    });

    vsCodeCtx.subscriptions.push(
        generateUmlDiagramCommand,
        checkProjectStandardsCommand
    );
}