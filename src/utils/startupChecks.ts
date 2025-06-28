// src/utils/startupChecks.ts

import * as vscode from 'vscode';
import { OllamaService } from '../services/OllamaService';
import { GiteaService } from '../services/GiteaService';
import { updateGiteaStatusBar } from '../ui/statusBar';

/**
 * Realiza comprobaciones al iniciar la extensión para asegurar que los servicios
 * necesarios están disponibles y configurados.
 */
export async function checkServicesAvailability(
    ollamaService: OllamaService, 
    giteaService: GiteaService,
    giteaStatusBarItem: vscode.StatusBarItem // Necesita la barra para actualizarla
): Promise<void> {
    
    // Verificar Ollama
    const ollamaAvailable = await ollamaService.isAvailable();
    if (!ollamaAvailable) {
        const selection = await vscode.window.showWarningMessage(
            'Ollama no parece estar ejecutándose. El análisis de código no funcionará.',
            'Abrir Docs de Ollama', 'Reintentar'
        );
        if (selection === 'Reintentar') {
            // Vuelve a ejecutar la comprobación.
            vscode.commands.executeCommand('ollamaCodeAnalyzer.checkGiteaStatus'); 
        } else if (selection === 'Abrir Docs de Ollama') {
            vscode.env.openExternal(vscode.Uri.parse('https://ollama.com/'));
        }
    }

    // Verificar Gitea
    const giteaConfigured = await giteaService.isConfigured();
    if (!giteaConfigured) {
        const selection = await vscode.window.showInformationMessage(
            'Gitea no está configurado. El análisis contextual está desactivado.',
            'Configurar Ahora'
        );
        if (selection === 'Configurar Ahora') {
            vscode.commands.executeCommand('ollamaCodeAnalyzer.configureGitea');
        }
    }

    // Actualizar la barra de estado después de las comprobaciones
    await updateGiteaStatusBar(giteaService, giteaStatusBarItem);

    // Mensaje de éxito si todo está bien
    if (ollamaAvailable && giteaConfigured) {
        const models = await ollamaService.getModels();
        vscode.window.showInformationMessage(`✅ Ollama y Gitea están listos! ${models.length} modelos cargados.`);
    }
}