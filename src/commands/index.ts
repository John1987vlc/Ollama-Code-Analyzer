// src/commands/index.ts
import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { registerOllamaCommands } from './OllamaCommands';
import { registerGiteaCommands } from './GiteaCommands';
import { updateGiteaStatusBar } from '../ui/statusBar';

/**
 * Registra todos los comandos de la extensión.
 * @param coreCtx El contexto central de la extensión.
 * @param vsCodeCtx El contexto de la extensión de VS Code.
 * @param status Contexto de la barra de estado
 */
export function registerAllCommands(coreCtx: CoreExtensionContext, vsCodeCtx: vscode.ExtensionContext,status:vscode.StatusBarItem ) {
    registerOllamaCommands(coreCtx, vsCodeCtx);
    registerGiteaCommands(vsCodeCtx,coreCtx,status);
}