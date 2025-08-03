
import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';

import { parseResponse } from '../utils/webviewUtils';
import { getWebviewHtml } from './webviewsContent';
import { ParsedWebviewContent, UmlProgressState } from './webviewsTypes';
import { Logger } from '../utils/logger';


import { I18n } from '../internationalization/i18n';

export class UnifiedResponseWebview {
    public static currentPanel: UnifiedResponseWebview | undefined;
    public static readonly viewType = 'ollamaUnifiedResponse';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private readonly md: MarkdownIt;

    private _loadingMessage = 'Contactando con Ollama...';
    private _umlProgressState: UmlProgressState = { processedFiles: [], remainingFiles: 0 };

    public static createOrShow(extensionUri: vscode.Uri, title: string) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel._panel.title = title;
            UnifiedResponseWebview.currentPanel._panel.reveal(column);
            UnifiedResponseWebview.currentPanel.showLoading();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            UnifiedResponseWebview.viewType,
            title,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'media')]
            }
        );

        UnifiedResponseWebview.currentPanel = new UnifiedResponseWebview(panel, extensionUri);
        UnifiedResponseWebview.currentPanel.showLoading();
    }

    // El constructor y otros métodos estáticos no cambian
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.md = new MarkdownIt({ html: true, linkify: true, typographer: true });

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'copyCode':
                        vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage(I18n.t('webview.panel.codeCopied'));
                        break;
                    case 'log':
                        // Logger.log(`Webview: ${message.message}`);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private _updateWebview(isLoading = false, isUmlGeneration = false, data: ParsedWebviewContent = { thinking: '', markdownContent: '', codeBlocks: [] }, referencedFilesTitle?: string) {
        Logger.log(`_updateWebview called with: isLoading=${isLoading}, isUmlGeneration=${isUmlGeneration}`);
        this._panel.webview.html = getWebviewHtml(
            this._panel,
            this._extensionUri,
            data,
            this._umlProgressState,
            this._loadingMessage,
            this.md,
            isLoading,
            isUmlGeneration,
            referencedFilesTitle,
                        {
                copied: I18n.t('webview.script.copied'),
                thinking: I18n.t('webview.panel.thinking'),
                umlProgress: I18n.t('webview.panel.umlProgress'),
                analyzedFiles: I18n.t('webview.panel.analyzedFiles'),
                currentlyAnalyzing: I18n.t('webview.panel.currentlyAnalyzing'),
                remainingFiles: I18n.t('webview.panel.remainingFiles'),
                loaderAriaLabel: I18n.t('webview.panel.loaderAriaLabel'),
                panelTitle: I18n.t('webview.panel.title')
            }
        );
    }

    // --- MÉTODOS DE UML RESTAURADOS ---
    public showUmlInitialLoading(totalFiles: number) {
        this._umlProgressState = { processedFiles: [], remainingFiles: totalFiles };
        this._loadingMessage = I18n.t('webview.panel.umlLoading');
        this._updateWebview(true, true); // <-- isUmlGeneration = true
    }

    public showUmlGenerationProgress(filePath: string, components: string) {
        this._umlProgressState.processedFiles.push({ path: filePath, components });
        this._umlProgressState.remainingFiles--;
        this._loadingMessage = I18n.t('webview.panel.umlLoading');
        this._updateWebview(true, true); // <-- isUmlGeneration = true
    }
    // --- FIN DE MÉTODOS DE UML ---

    public showLoading() {
        this._loadingMessage = I18n.t('webview.panel.loading');
        this._updateWebview(true, false); // <-- isUmlGeneration = false
    }

    public showResponse(fullResponse: string, debugData?: any, rawResponse?: string | null, isRenderedUml: boolean = false, referencedFilesTitle?: string) {
        
        const parsedContent = parseResponse(fullResponse);
        let thinkingContent = '';
        if (referencedFilesTitle) {
            thinkingContent += `**${referencedFilesTitle}**\n\n`;
        }
        if (debugData) {
            const debugJson = JSON.stringify(debugData, null, 2);
            thinkingContent += `**Datos enviados al modelo para la síntesis final:** ${debugJson} \``
        }
		if (rawResponse) {
            if(thinkingContent) {
                thinkingContent += `\n\n<hr>\n\n`;
            }
            thinkingContent += `**Respuesta RAW del LLM:**\n\n\`\`\`${rawResponse}\`\`\``;
        } 
        parsedContent.thinking = thinkingContent;
        parsedContent.referencedFilesTitle = referencedFilesTitle;
        // Reset UML progress state and loading message when showing the final response
        this._umlProgressState = { processedFiles: [], remainingFiles: 0 };
        this._loadingMessage = ''; // Clear the loading message
        this._updateWebview(false, isRenderedUml, parsedContent, referencedFilesTitle);
    }

    public dispose() {
        UnifiedResponseWebview.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}