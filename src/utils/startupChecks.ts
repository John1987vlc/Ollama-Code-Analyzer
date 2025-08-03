/**
 * @file Realiza comprobaciones al iniciar la extensión.
 * Verifica la disponibilidad de servicios externos como Ollama
 * y muestra notificaciones al usuario si algo no está configurado
 * o no funciona correctamente.
 */

import * as vscode from 'vscode';
import { OllamaService } from '../api/OllamaService';

/**
 * Realiza comprobaciones al iniciar la extensión para asegurar que los servicios
 * necesarios están disponibles y configurados.
 */
export async function checkServicesAvailability(
    ollamaService: OllamaService, 
): Promise<void> {
    
    // Verificar Ollama
    const ollamaAvailable = await ollamaService.isAvailable();
    if (!ollamaAvailable) {
        const selection = await vscode.window.showWarningMessage(
            'Ollama code analyzer is not working','Reintentar'
        );
        if (selection === 'Reintentar') {
            // Vuelve a ejecutar la comprobación.
            vscode.commands.executeCommand('ollamaCodeAnalyzer.checkGiteaStatus'); 
        } else if (selection === 'Abrir Docs de Ollama') {
            vscode.env.openExternal(vscode.Uri.parse('https://ollama.com/'));
        }
    }


    // Mensaje de éxito si todo está bien
    if (ollamaAvailable) {
        const models = await ollamaService.getModels();
        vscode.window.showInformationMessage(`✅ Ollama está listo! ${models.length} modelos cargados.`);
    }
}