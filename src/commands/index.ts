// src/commands/index.ts - Archivo principal de comandos
import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { registerAnalysisCommands } from './AnalysisCommands';
import { registerGenerationCommands } from './GenerationCommands';
import { registerProjectCommands } from './ProjectCommands';
import { registerConfigurationCommands } from '././ConfigurationCommands';

export function registerAllCommands(coreCtx: CoreExtensionContext, vsCodeCtx: vscode.ExtensionContext) {
    registerAnalysisCommands(coreCtx, vsCodeCtx);
    registerGenerationCommands(coreCtx, vsCodeCtx);
    registerProjectCommands(coreCtx, vsCodeCtx);
    registerConfigurationCommands(coreCtx, vsCodeCtx);
}