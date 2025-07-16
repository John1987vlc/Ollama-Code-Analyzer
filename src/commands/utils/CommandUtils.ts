import * as vscode from 'vscode';
import { UnifiedResponseWebview } from '../../ui/webviews';
import { I18n } from '../../internationalization/i18n';

export async function executeCommandWithWebview(
    vsCodeCtx: vscode.ExtensionContext,
    loadingTitle: string,
    serviceCall: () => Promise<{ prompt: string, response: string | null } | null>
) {
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const model = config.get<string>('model');

    if (!model) {
        vscode.window.showErrorMessage(I18n.t('error.noModelConfigured'));
        return;
    }

    UnifiedResponseWebview.createOrShow(vsCodeCtx.extensionUri, loadingTitle);

    try {
        const result = await serviceCall();

        if (UnifiedResponseWebview.currentPanel) {
            if (result && result.response) {
                UnifiedResponseWebview.currentPanel.showResponse(result.response);
            } else {
                UnifiedResponseWebview.currentPanel.showResponse(I18n.t('error.noValidResponse'));
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : I18n.t('error.unknown');
        if (UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel.showResponse(`${I18n.t('error.executingCommand')}: ${errorMessage}`);
        } else {
            vscode.window.showErrorMessage(`${I18n.t('error.inCommand')}: ${errorMessage}`);
        }
    }
}