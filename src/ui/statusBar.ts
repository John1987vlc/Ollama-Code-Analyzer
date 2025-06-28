// src/ui/statusBar.ts

import * as vscode from 'vscode';
import { GiteaService } from '../services/GiteaService';

/**
 * Actualiza el texto, el tooltip y el color del StatusBarItem de Gitea
 * basándose en si el servicio está configurado o no.
 * @param giteaService La instancia del servicio de Gitea.
 * @param statusBarItem El item de la barra de estado a actualizar.
 */
export async function updateGiteaStatusBar(
    giteaService: GiteaService,
    statusBarItem: vscode.StatusBarItem
): Promise<void> {
    
    // El comando se puede asignar una sola vez, pero lo dejamos aquí por si cambia en el futuro.
    statusBarItem.command = 'ollamaCodeAnalyzer.checkGiteaStatus'; // Asumiendo que tienes este comando

    if (await giteaService.isConfigured()) {
        // Estado: Configurado y listo
        statusBarItem.text = `$(git-branch) Gitea`;
        statusBarItem.tooltip = 'Gitea está configurado y listo para el análisis contextual.';
        statusBarItem.backgroundColor = undefined; // Sin color de fondo de advertencia
    } else {
        // Estado: No configurado
        statusBarItem.text = `$(warning) Gitea no configurado`;
        statusBarItem.tooltip = 'Click para configurar Gitea y habilitar el análisis contextual.';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }

    statusBarItem.show();
}