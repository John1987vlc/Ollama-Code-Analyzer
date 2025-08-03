/**
 * @file Utilidades compartidas para la ejecución de comandos.
 * Proporciona funciones auxiliares, como `executeCommandWithWebview`, para
 * estandarizar la forma en que los comandos interactúan con la UI (Webviews)
 * y manejan los estados de carga y los errores.
 */

import * as vscode from 'vscode';
import { UnifiedResponseWebview } from '../../ui/webviews';
import { I18n } from '../../internationalization/i18n';
import { Logger } from '../../utils/logger'; // Importa el Logger

export async function executeCommandWithWebview(
    vsCodeCtx: vscode.ExtensionContext,
    loadingTitleKey: string,
    serviceCall: () => Promise<{ prompt: string, response: string | null } | null>
) {
    Logger.log(`Ejecutando comando: ${loadingTitleKey}`); // <-- Escribe en el log

    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const model = config.get<string>('model');
    const title = I18n.t(loadingTitleKey);

    if (!model) {
        const errorMsg = 'No hay un modelo configurado.';
        Logger.error(errorMsg); // <-- Log del error
        vscode.window.showErrorMessage(I18n.t('error.noModelConfigured'));
        return;
    }

    UnifiedResponseWebview.createOrShow(vsCodeCtx.extensionUri, title);

    try {
        const result = await serviceCall();

        if (UnifiedResponseWebview.currentPanel) {
            if (result && result.response) {
                UnifiedResponseWebview.currentPanel.showResponse(result.response);
                Logger.log(`Comando '${loadingTitleKey}' completado con éxito.`);
            } else {
                UnifiedResponseWebview.currentPanel.showResponse(I18n.t('error.noValidResponse'));
                Logger.error(`Comando '${loadingTitleKey}' no devolvió una respuesta válida.`);
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : I18n.t('error.unknown');

        Logger.error(`Error ejecutando el comando '${loadingTitleKey}':`, error);

        if (UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel.showResponse(`${I18n.t('error.executingCommand')}: ${errorMessage}`);
        } else {
            vscode.window.showErrorMessage(`${I18n.t('error.inCommand')}: ${errorMessage}`);
        }
    }
}