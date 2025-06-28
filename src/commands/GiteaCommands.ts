// src/commands/giteaCommands.ts
import * as vscode from 'vscode';
import { GiteaService } from '../services/GiteaService';
import { GitContextAnalyzer } from '../services/GitContextAnalyzer';
import { GitContextTreeProvider } from '../providers/GitContextTreeProvider';

export function registerGiteaCommands(
    context: vscode.ExtensionContext,
    giteaService: GiteaService,
    gitContextAnalyzer: GitContextAnalyzer,
    gitContextProvider: GitContextTreeProvider
) {
    // Comando para configurar la conexión con Gitea
    const configureGitea = vscode.commands.registerCommand('ollamaCodeAnalyzer.configureGitea', async () => {
        const giteaUrl = await vscode.window.showInputBox({
            prompt: 'Introduce la URL de tu instancia de Gitea (ej. https://gitea.com)',
            value: "",
            ignoreFocusOut: true,
        });

        if (!giteaUrl) {
            vscode.window.showWarningMessage('La configuración de Gitea ha sido cancelada.');
            return;
        }

        const accessToken = await vscode.window.showInputBox({
            prompt: 'Introduce tu Token de Acceso de Gitea',
            password: true,
            ignoreFocusOut: true,
        });

        if (!accessToken) {
            vscode.window.showWarningMessage('La configuración de Gitea ha sido cancelada.');
            return;
        }

        try {
            await giteaService.saveConfiguration(giteaUrl, accessToken);
            vscode.window.showInformationMessage('¡Gitea configurado correctamente!');
            // Actualiza la barra de estado y el tree view
            vscode.commands.executeCommand('ollamaCodeAnalyzer.checkGiteaStatus');
            gitContextProvider.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Error al guardar la configuración de Gitea: ${error}`);
        }
    });

    // Comando para verificar el estado de la conexión con Gitea (usado por la barra de estado)
    const checkGiteaStatus = vscode.commands.registerCommand('ollamaCodeAnalyzer.checkGiteaStatus', async () => {
        const isConfigured = await giteaService.isConfigured();
        if (isConfigured) {
            const isValid = await giteaService.isConfigured();
            if (isValid) {
                vscode.window.showInformationMessage('Conexión con Gitea verificada correctamente.');
            } else {
                vscode.window.showErrorMessage('No se pudo verificar la conexión con Gitea. Revisa la URL y el token.');
            }
        } else {
            vscode.window.showWarningMessage('Gitea no está configurado.', 'Configurar Gitea')
                .then(selection => {
                    if (selection === 'Configurar Gitea') {
                        vscode.commands.executeCommand('ollamaCodeAnalyzer.configureGitea');
                    }
                });
        }
    });

    // Comando para analizar el archivo actual con contexto de Git
    const analyzeWithGiteaContext = vscode.commands.registerCommand('ollamaCodeAnalyzer.analyzeWithGiteaContext', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            if (await giteaService.isConfigured()) {
                await gitContextAnalyzer.analyzeFileWithGitContext(editor.document);
            } else {
                vscode.window.showWarningMessage('Por favor, configura Gitea para usar esta función.');
            }
        } else {
            vscode.window.showInformationMessage('Abre un archivo para analizarlo con contexto de Gitea.');
        }
    });

    // Comando para refrescar el Tree View del contexto de Gitea
    const refreshGiteaContextView = vscode.commands.registerCommand(
  'ollamaCodeAnalyzer.refreshGiteaContextView',
  () => {
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor) {
      const relativePath = getRelativeFilePath(activeEditor.document.uri);
      if (relativePath) {
        gitContextProvider.refresh(relativePath);
        vscode.window.showInformationMessage('Vista de contexto de Gitea actualizada.');
      } else {
        vscode.window.showWarningMessage('No se pudo obtener la ruta relativa del archivo.');
      }
    } else {
      vscode.window.showWarningMessage('No hay un editor activo.');
    }
  }
);


    context.subscriptions.push(
        configureGitea,
        checkGiteaStatus,
        analyzeWithGiteaContext,
        refreshGiteaContextView
    );
}

// Función auxiliar para obtener la ruta relativa (debe ser la misma que en extension.ts)
function getRelativeFilePath(uri: vscode.Uri): string | null {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        return null;
    }
    const path = require('path');
    return path.relative(workspaceFolder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
}