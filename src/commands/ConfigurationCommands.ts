/**
 * @file Registra los comandos relacionados con la configuración de la extensión.
 * Permite al usuario configurar el modelo de Ollama y el idioma de salida
 * a través de la paleta de comandos.
 */
// src/commands/ConfigurationCommands.ts
import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { I18n } from '../internationalization/i18n';

export function registerConfigurationCommands(coreCtx: CoreExtensionContext, vsCodeCtx: vscode.ExtensionContext) {

    const configureModelCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.configureModel', async () => {
        const { ollamaService } = coreCtx;
        try {
            const models = await ollamaService.getModels();
            if (!models || models.length === 0) {
                vscode.window.showWarningMessage('No se encontraron modelos de Ollama. Asegúrate de que Ollama esté en ejecución y tenga modelos descargados.');
                return;
            }

            const modelItems = models.map(m => ({
                label: m.name,
                description: `Familia: ${m.details.family}`
            }));

            const selectedModel = await vscode.window.showQuickPick(modelItems, {
                placeHolder: 'Selecciona el modelo a utilizar',
                title: 'Configurar Modelo de Ollama'
            });

            if (selectedModel) {
                await vscode.workspace.getConfiguration('ollamaCodeAnalyzer').update('model', selectedModel.label, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Modelo de Ollama configurado en: ${selectedModel.label}`);
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
            vscode.window.showErrorMessage(`Error al obtener los modelos de Ollama: ${errorMessage}`);
        }
    });

    const configureLanguageCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.configureLanguage', async () => {
        const selectedLanguage = await vscode.window.showQuickPick(['Español', 'English'], {
            placeHolder: 'Selecciona el idioma de salida para las respuestas de la IA',
            title: 'Configurar Idioma de Salida'
        });

        if (selectedLanguage) {
            await vscode.workspace.getConfiguration('ollamaCodeAnalyzer').update('outputLanguage', selectedLanguage, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Idioma de salida configurado en: ${selectedLanguage}`);
            // Recargar I18n para que tome el nuevo idioma
            I18n.initialize(vsCodeCtx);
        }
    });

    vsCodeCtx.subscriptions.push(
        configureModelCommand,
        configureLanguageCommand
    );
}