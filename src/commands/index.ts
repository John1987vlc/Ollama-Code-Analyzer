/**
 * @file Punto de entrada para el registro de todos los comandos de la extensión.
 * Importa y ejecuta las funciones de registro de los diferentes módulos de comandos
 * para mantener el código organizado.
 */

import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { registerAnalysisCommands } from './AnalysisCommands';
import { registerGenerationCommands } from './GenerationCommands';
import { registerProjectCommands } from './ProjectCommands';
import { registerConfigurationCommands } from './ConfigurationCommands';

export function registerAllCommands(coreCtx: CoreExtensionContext, vsCodeCtx: vscode.ExtensionContext) {
    registerAnalysisCommands(coreCtx, vsCodeCtx);
    registerGenerationCommands(coreCtx, vsCodeCtx);
    registerProjectCommands(coreCtx, vsCodeCtx);
    registerConfigurationCommands(coreCtx, vsCodeCtx);
}