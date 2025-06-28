// src/extension.ts

import * as vscode from 'vscode';
import { OllamaService } from './services/OllamaService';
import { CodeAnalyzer } from './services/CodeAnalyzer';
import { GiteaService } from './services/GiteaService';
import { GitContextAnalyzer } from './services/GitContextAnalyzer';
import { GitContextTreeProvider } from './providers/GitContextTreeProvider';
import { registerOllamaCommands } from './commands/OllamaCommands';
import { registerGiteaCommands } from './commands/GiteaCommands';
import { registerEventListeners } from './events/listeners';
import { updateGiteaStatusBar } from './ui/statusBar';
import { checkServicesAvailability } from './utils/startupChecks'; // Importamos la nueva función

/**
 * Contenedor de servicios para pasarlos fácilmente a otros módulos.
 */
export interface ExtensionServices {
    ollamaService: OllamaService;
    codeAnalyzer: CodeAnalyzer;
    giteaService: GiteaService;
    gitContextAnalyzer: GitContextAnalyzer;
    gitContextProvider: GitContextTreeProvider;
}

/**
 * Función principal que se ejecuta cuando la extensión es activada.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Activando extensión "Ollama Code Analyzer"...');

    // 1. Inicialización de Servicios
    const ollamaService = new OllamaService();
    const codeAnalyzer = new CodeAnalyzer(ollamaService);
    const giteaService = new GiteaService();
    const gitContextAnalyzer = new GitContextAnalyzer(giteaService, ollamaService);
    const gitContextProvider = new GitContextTreeProvider(giteaService);
    
    const services: ExtensionServices = {
        ollamaService, codeAnalyzer, giteaService, gitContextAnalyzer, gitContextProvider
    };

    // 2. Registrar Vistas y UI
    const gitContextView = vscode.window.createTreeView('giteaContext', {
        treeDataProvider: gitContextProvider,
        showCollapseAll: true
    });
    
    const giteaStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    
    // 3. Registrar Comandos
    // [CORRECCIÓN] Pasamos giteaStatusBarItem a los módulos que lo necesitan.
    registerOllamaCommands(context, services);
    registerGiteaCommands(context, services, giteaStatusBarItem);

    // 4. Registrar Listeners de Eventos
    // [CORRECCIÓN] Pasamos giteaStatusBarItem a los módulos que lo necesitan.
    registerEventListeners(context, services, giteaStatusBarItem);

    // 5. Agregar elementos desechables al contexto
    context.subscriptions.push(
        gitContextView,
        giteaStatusBarItem
    );
    
    // 6. Verificaciones iniciales de arranque
    checkServicesAvailability(ollamaService, giteaService, giteaStatusBarItem);
    
    console.log('Extensión "Ollama Code Analyzer" activada y lista.');
}

/**
 * Función que se ejecuta cuando la extensión es desactivada.
 */
export function deactivate() {
    console.log('Desactivando extensión...');
}