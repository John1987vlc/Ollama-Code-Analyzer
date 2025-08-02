// src/ui/webviews.ts

import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
const kroki = require('@kazumatu981/markdown-it-kroki');

import { parseResponse } from '../utils/webviewUtils';
import { getWebviewHtml } from './webviewsContent';
import { ParsedWebviewContent, UmlProgressState } from './webviewsTypes';


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
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        UnifiedResponseWebview.currentPanel = new UnifiedResponseWebview(panel, extensionUri);
        UnifiedResponseWebview.currentPanel.showLoading();
    }

    // El constructor y otros métodos estáticos no cambian
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.md = new MarkdownIt({ html: true, linkify: true, typographer: true }).use(kroki);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'copyCode') {
                    vscode.env.clipboard.writeText(message.text);
                    vscode.window.showInformationMessage('¡Código copiado al portapapeles!');
                }
            },
            null,
            this._disposables
        );
    }

    private _updateWebview(isLoading = false, isUmlGeneration = false, data: ParsedWebviewContent = { thinking: '', markdownContent: '', codeBlocks: [] }) {
        this._panel.webview.html = getWebviewHtml(
            this._panel,
            this._extensionUri,
            data,
            this._umlProgressState,
            this._loadingMessage,
            this.md,
            isLoading,
            isUmlGeneration // <-- Se pasa el flag
        );
    }

    // --- MÉTODOS DE UML RESTAURADOS ---
    public showUmlInitialLoading(totalFiles: number) {
        this._umlProgressState = { processedFiles: [], remainingFiles: totalFiles };
        this._loadingMessage = 'Analizando archivos para generar diagrama UML...';
        this._updateWebview(true, true); // <-- isUmlGeneration = true
    }

    public showUmlGenerationProgress(filePath: string, components: string) {
        this._umlProgressState.processedFiles.push({ path: filePath, components });
        this._umlProgressState.remainingFiles--;
        this._loadingMessage = 'Analizando archivos para generar diagrama UML...';
        this._updateWebview(true, true); // <-- isUmlGeneration = true
    }
    // --- FIN DE MÉTODOS DE UML ---

    public showLoading() {
        this._loadingMessage = 'Contactando con Gemma3...';
        this._updateWebview(true, false); // <-- isUmlGeneration = false
    }

    public showResponse(fullResponse: string, debugData?: any) {
        const parsedContent = parseResponse(fullResponse);
        if (debugData) {
            const debugJson = JSON.stringify(debugData, null, 2);
            parsedContent.thinking = `**Datos enviados al modelo para la síntesis final:**\n\n\`\`\`json\n${debugJson}\n\`\`\``;
        }
        this._updateWebview(false, false, parsedContent);
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