// src/ui/webviews.ts
import * as vscode from 'vscode';

interface WebviewResponse {
    thinking: string;
    markdownContent: string;
    codeBlocks: { language: string; code: string }[];
}

/**
 * Gestiona una vista web unificada para mostrar el estado de carga y las respuestas de Ollama.
 */
export class UnifiedResponseWebview {
    public static currentPanel: UnifiedResponseWebview | undefined;
    public static readonly viewType = 'ollamaUnifiedResponse';
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, title: string) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel._panel.title = title;
            UnifiedResponseWebview.currentPanel._panel.reveal(column);
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
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

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

        this.showLoading();
    }

    /** Muestra un indicador de carga en la webview. */
    public showLoading() {
        this._panel.webview.html = this._getHtmlForWebview({
            thinking: "Procesando su petición con Ollama...",
            markdownContent: "Por favor, espere.",
            codeBlocks: []
        }, true);
    }

    /**
     * Procesa y muestra la respuesta final de Ollama.
     * @param fullResponse La respuesta completa del servicio.
     * @param prompt El prompt utilizado para generar la respuesta.
     */
    public showResponse(fullResponse: string, prompt: string) {
        const parsedResponse = this.parseResponse(fullResponse);
        this._panel.webview.html = this._getHtmlForWebview({
            thinking: prompt,
            ...parsedResponse
        });
    }

    private parseResponse(text: string): { markdownContent: string, codeBlocks: { language: string, code: string }[] } {
        const codeBlocks: { language: string; code: string }[] = [];
        // Primero, nos aseguramos de que el texto de entrada sea una cadena
        const content = typeof text === 'string' ? text : '';
        const markdownContent = content.replace(/```(\w*)\s*([\s\S]*?)```/g, (match, language, code) => {
            codeBlocks.push({ language: language || 'plaintext', code: code.trim() });
            return ``;
        });

        return { markdownContent, codeBlocks };
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

    private _getHtmlForWebview(data: WebviewResponse, isLoading = false): string {
        const { thinking, markdownContent, codeBlocks } = data;
        const nonce = getNonce();

        // Usamos Markdown-it para renderizar el contenido. VS Code lo gestiona internamente.
        // La API de `vscode.MarkdownString` no está disponible directamente en la webview,
        // pero podemos simular su comportamiento o usar una librería si fuera necesario.
        // Aquí lo mantenemos simple.
        let renderedContent = markdownContent;

        codeBlocks.forEach((block, index) => {
            const codeHtml = `
                <div class="code-container">
                    <div class="code-header">
                        <span>${block.language}</span>
                        <button class="copy-btn" data-code="${escape(block.code)}">Copiar</button>
                    </div>
                    <pre><code>${escape(block.code)}</code></pre>
                </div>`;
            renderedContent = renderedContent.replace(``, codeHtml);
        });

        return `<!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Respuesta de Ollama</title>
                <style>
                    /* Estilos generales y para el modo oscuro/claro de VSCode */
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 1em;
                    }
                    details {
                        background-color: var(--vscode-side-bar-background);
                        border: 1px solid var(--vscode-side-bar-border);
                        border-radius: 4px;
                        margin-bottom: 1em;
                    }
                    summary {
                        font-weight: bold;
                        padding: 0.5em;
                        cursor: pointer;
                    }
                    .thinking-content {
                        padding: 0.5em;
                        border-top: 1px solid var(--vscode-side-bar-border);
                        white-space: pre-wrap;
                        background-color: var(--vscode-input-background);
                    }
                    .response-content {
                        margin-top: 1em;
                    }
                    .code-container {
                        margin: 1em 0;
                        border-radius: 4px;
                        border: 1px solid var(--vscode-editor-widget-border);
                        background-color: var(--vscode-text-block-quote-background);
                    }
                    .code-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background-color: var(--vscode-peek-view-title-background);
                        padding: 4px 8px;
                        border-bottom: 1px solid var(--vscode-editor-widget-border);
                    }
                    .code-header span {
                        font-size: 0.8em;
                        text-transform: uppercase;
                    }
                    .copy-btn {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 4px 8px;
                        cursor: pointer;
                        border-radius: 3px;
                    }
                    .copy-btn:hover {
                        background-color: var(--vscode-button-hover-background);
                    }
                    pre {
                        margin: 0;
                        padding: 1em;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    }
                    code {
                         font-family: var(--vscode-editor-font-family);
                    }
                    ${isLoading ? `
                    .loading {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        font-size: 1.2em;
                    }
                    .spinner {
                        border: 4px solid var(--vscode-editor-foreground, #ccc);
                        border-top: 4px solid var(--vscode-button-background, #3498db);
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin-right: 15px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    ` : ''}
                </style>
            </head>
            <body>
                ${isLoading ? `
                <div class="loading">
                    <div class="spinner"></div>
                    <div>${thinking}</div>
                </div>
                ` : `
                <details>
                    <summary>Ver Pensamiento del Modelo</summary>
                    <div class="thinking-content"><pre><code>${escape(thinking)}</code></pre></div>
                </details>
                <div class="response-content">
                    ${renderedContent}
                </div>
                `}
                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    document.querySelectorAll('.copy-btn').forEach(button => {
                        button.addEventListener('click', event => {
                            // Usamos currentTarget para asegurar que el evento está en el botón
                            const targetButton = event.currentTarget;
                            if (targetButton) {
                               const code = unescape(targetButton.getAttribute('data-code') || '');
                               vscode.postMessage({
                                   command: 'copyCode',
                                   text: code
                               });
                            }
                        });
                    });
                </script>
            </body>
            </html>`;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function escape(htmlStr: string): string {
    // [CORREGIDO] Añadimos una guarda para evitar errores si el input no es una cadena.
    if (typeof htmlStr !== 'string') {
        return '';
    }
    return htmlStr.replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
}