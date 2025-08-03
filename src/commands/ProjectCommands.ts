import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { UnifiedResponseWebview } from '../ui/webviews';
import { I18n } from '../internationalization/i18n';
import { findProjectFiles } from './utils/ProjectUtils';
import { Logger } from '../utils/logger';

interface UmlComponent {
  name: string;
  type: string;
}

interface UmlStructure {
  components?: UmlComponent[];
  [key: string]: any;
}

interface PerFileHandler<TAccum> {
  (file: { path: string; content: string }, accum: TAccum): Promise<{
    progressDescription: string;
    accum: TAccum;
  }>;
}

async function withProjectFiles<TAccum>(
  coreCtx: CoreExtensionContext,
  vsCodeCtx: vscode.ExtensionContext,
  title: string,
  noWorkspaceKey: string,
  noFilesKey: string,
  perFileHandler: PerFileHandler<TAccum>,
  initialAccum: TAccum,
  finalHandler: (accum: TAccum) => Promise<void>,
): Promise<{ success: boolean; accum: TAccum }> {
  const rootFolder = vscode.workspace.workspaceFolders?.[0];
  if (!rootFolder) {
    vscode.window.showInformationMessage(I18n.t(noWorkspaceKey));
    return { success: false, accum: initialAccum };
  }

  UnifiedResponseWebview.createOrShow(vsCodeCtx.extensionUri, title);
  const panel = UnifiedResponseWebview.currentPanel;
  if (!panel) {
    vscode.window.showErrorMessage('No se pudo inicializar la webview');
    return { success: false, accum: initialAccum };
  }

  const files = await findProjectFiles(rootFolder.uri);
  if (files.length === 0) {
    vscode.window.showInformationMessage(I18n.t(noFilesKey));
    panel.showResponse(I18n.t(noFilesKey));
    return { success: false, accum: initialAccum };
  }

  panel.showUmlInitialLoading(files.length);

  let accum = initialAccum;
  for (const file of files) {
    const { progressDescription, accum: updated } = await perFileHandler(file, accum);
    accum = updated;
    panel.showUmlGenerationProgress(file.path, progressDescription);
  }

  await finalHandler(accum);

  return { success: true, accum };
}

export function registerProjectCommands(coreCtx: CoreExtensionContext, vsCodeCtx: vscode.ExtensionContext) {
  const generateUmlDiagramCommand = vscode.commands.registerCommand(
    'ollamaCodeAnalyzer.generateUmlDiagram',
    async () => {
      const title = I18n.t('command.generateUmlDiagram.title');

      const { success } = await withProjectFiles<UmlStructure[]>(
        coreCtx,
        vsCodeCtx,
        title,
        'command.generateUmlDiagram.noWorkspace',
        'command.generateUmlDiagram.noFiles',
        async (file, accum) => {
          const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!;
          const structure = await coreCtx.ollamaService.extractUmlStructureFromFile(file, model);
          let componentsFound = I18n.t('command.generateUmlDiagram.analyzing');

          if (structure) {
            accum.push(structure as UmlStructure);
            if ((structure as UmlStructure).components && (structure as UmlStructure).components!.length > 0) {
              componentsFound = (structure as UmlStructure).components!
                .map((c: UmlComponent) => `${c.name} (${c.type})`)
                .join(', ');
            } else {
              componentsFound = I18n.t('command.generateUmlDiagram.noComponents');
            }
          } else {
            componentsFound = I18n.t('command.generateUmlDiagram.cannotAnalyze');
          }
          return { progressDescription: componentsFound, accum };
        },
        [],
        async allFileStructures => {
          const panel = UnifiedResponseWebview.currentPanel;
          if (!panel) return;

          if (allFileStructures.length > 0) {
            Logger.log('Enviando a Ollama para síntesis:', allFileStructures);
            const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!;
            const { uml: finalUmlContent, rawResponse } = await coreCtx.ollamaService.synthesizeUmlDiagram(
              allFileStructures,
              model,
            );
            Logger.log('Respuesta de Ollama para síntesis:', { finalUmlContent, rawResponse });

            if (finalUmlContent) {
              Logger.log('finalUmlContent is not empty, proceeding to render.');
              const sentinel = 'undefined command.generateUmlDiagram.diagram';
              if (finalUmlContent.includes(sentinel)) {
                Logger.log('Sentinel value found in response. Showing generation failed message.');
                panel.showResponse(
                  I18n.t('command.generateUmlDiagram.generationFailed'),
                  allFileStructures,
                  rawResponse,
                );
              } else {
                try {
                  Logger.log('Attempting to render PlantUML...');
                  const svgContent = await coreCtx.ollamaService.renderPlantUml(finalUmlContent);
                  Logger.log('PlantUML rendering successful. SVG content length:', svgContent?.length);
                  panel.showResponse(svgContent || finalUmlContent, allFileStructures, rawResponse, true);
                  Logger.log('panel.showResponse called after rendering.');
                } catch (renderErr) {
                  Logger.error('Error renderizando PlantUML, mostrando texto crudo:', renderErr);
                  panel.showResponse(finalUmlContent, allFileStructures, rawResponse,true);
                }
              }
            } else {
              Logger.log('finalUmlContent is empty. Showing "cannotGenerateFinal" message.');
              panel.showResponse(
                I18n.t('command.generateUmlDiagram.cannotGenerateFinal'),
                allFileStructures,
                rawResponse,
              );
            }
          } else {
            panel.showResponse(I18n.t('command.generateUmlDiagram.noValidStructure'));
          }
        },
      );
    },
  );

  const checkProjectStandardsCommand = vscode.commands.registerCommand(
    'ollamaCodeAnalyzer.checkProjectStandards',
    async () => {
      const title = I18n.t('command.checkProjectStandards.title');

      const { success } = await withProjectFiles<string[]>(coreCtx, vsCodeCtx, title, 'command.checkProjectStandards.noWorkspace', 'command.checkProjectStandards.noFiles', async (file, accum) => {
        const prompt = await coreCtx.promptingService.getStandardsPrompt(file.content, vscode.workspace.asRelativePath(file.path));
        const model = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('model')!;
        const result = await coreCtx.ollamaService.generate(prompt, model);
        const response = result?.response ?? I18n.t('command.checkProjectStandards.noResponse');

        const part = `## ${I18n.t('command.checkProjectStandards.fileLabel')}: ${file.path}\n\n${response}`;
        accum.push(part);
        return { progressDescription: I18n.t('command.checkProjectStandards.analyzed'), accum };
      }, [], async reportParts => {
        const panel = UnifiedResponseWebview.currentPanel;
        if (!panel) return;

        const header = `# ${I18n.t('command.checkProjectStandards.reportTitle')}`;
        const finalReport = [header, ...reportParts, '---'].join('\n\n');
        panel.showResponse(finalReport);
      });
    },
  );

  vsCodeCtx.subscriptions.push(generateUmlDiagramCommand, checkProjectStandardsCommand);
}
