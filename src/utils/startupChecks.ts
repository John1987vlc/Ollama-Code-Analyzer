// src/utils/startupChecks.ts

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


    // Mensaje de éxito si todo está bien
    if (ollamaAvailable) {
        const models = await ollamaService.getModels();
        vscode.window.showInformationMessage(`✅ Ollama está listo! ${models.length} modelos cargados.`);
    }
}