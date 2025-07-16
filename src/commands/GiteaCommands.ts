// src/commands/giteaCommands.ts

import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext'; // Importamos la interfaz de servicios
import { getRelativeFilePath } from '../utils/pathUtils'; // Importamos la utilidad
import { updateGiteaStatusBar } from '../ui/statusBar'; // Importamos el actualizador de UI

export function registerGiteaCommands(
  context: vscode.ExtensionContext,
  services: CoreExtensionContext, // [CORREGIDO] Usamos el objeto de servicios unificado
  giteaStatusBarItem: vscode.StatusBarItem // Pasamos el item para poder actualizarlo
) {
  // Desestructuramos los servicios que vamos a necesitar
  const { giteaService, gitContextProvider } = services;

  /**
   * [REESCRITO] Comando para configurar Gitea de forma interactiva.
   */
  const configureGitea = vscode.commands.registerCommand('ollamaCodeAnalyzer.configureGitea', async () => {
    // Un asistente paso a paso para obtener los datos del usuario
    const baseUrl = await vscode.window.showInputBox({
      prompt: 'Introduce la URL base de tu instancia de Gitea (ej: https://gitea.com)',
      ignoreFocusOut: true,
      title: 'Configuración de Gitea (Paso 1 de 4)'
    });
    if (!baseUrl) return;

    const token = await vscode.window.showInputBox({
      prompt: 'Introduce tu Access Token de Gitea',
      password: true,
      ignoreFocusOut: true,
      title: 'Configuración de Gitea (Paso 2 de 4)'
    });
    if (!token) return;

    const organization = await vscode.window.showInputBox({
        prompt: 'Introduce el nombre de la organización o tu nombre de usuario',
        ignoreFocusOut: true,
        title: 'Configuración de Gitea (Paso 3 de 4)'
    });
    if (!organization) return;

    const repository = await vscode.window.showInputBox({
        prompt: 'Introduce el nombre del repositorio',
        ignoreFocusOut: true,
        title: 'Configuración de Gitea (Paso 4 de 4)'
    });
    if (!repository) return;

    try {
      await giteaService.saveConfiguration(baseUrl, token, organization, repository);
      vscode.window.showInformationMessage('✅ ¡Gitea configurado correctamente!');
      // Actualiza la UI para reflejar el nuevo estado
      await updateGiteaStatusBar(giteaService, giteaStatusBarItem);
      gitContextProvider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Error al guardar la configuración de Gitea: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  });

  /**
   * [CORREGIDO] Comando para verificar el estado REAL de la conexión con Gitea.
   */
  const checkGiteaStatus = vscode.commands.registerCommand('ollamaCodeAnalyzer.checkGiteaStatus', async () => {
    if (!await giteaService.isConfigured()) {
      const selection = await vscode.window.showWarningMessage(
        'Gitea no está configurado.',
        'Configurar Ahora'
      );
      if (selection === 'Configurar Ahora') {
        vscode.commands.executeCommand('ollamaCodeAnalyzer.configureGitea');
      }
      return;
    }

    // Usamos el nuevo método para una verificación real
    const isValid = await giteaService.testConnection();
    if (isValid) {
      vscode.window.showInformationMessage('✅ Conexión con Gitea verificada correctamente.');
    } else {
      vscode.window.showErrorMessage('❌ No se pudo verificar la conexión con Gitea. Revisa la URL, el token o tu conexión de red.');
    }
    // Actualizamos la barra de estado en cualquier caso
    await updateGiteaStatusBar(giteaService, giteaStatusBarItem);
  });
  
  /**
   * Comando para refrescar manualmente la vista de árbol del contexto de Gitea.
   */
  const refreshGiteaContextView = vscode.commands.registerCommand('ollamaCodeAnalyzer.refreshGiteaContextView', () => {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const relativePath = getRelativeFilePath(editor.document.uri);
    if (relativePath) {
      gitContextProvider.refresh(relativePath);
      vscode.window.showInformationMessage('Vista de contexto de Gitea actualizada.');
    } else {
      vscode.window.showWarningMessage('No se pudo obtener la ruta relativa del archivo.');
    }
  } else {
    vscode.window.showWarningMessage('No hay editor activo para actualizar la vista de contexto.');
  }
});

  context.subscriptions.push(
    configureGitea,
    checkGiteaStatus,
    refreshGiteaContextView
  );
}