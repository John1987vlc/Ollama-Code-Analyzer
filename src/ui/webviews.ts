// src/ui/webviews.ts
import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import plantuml from 'markdown-it-plantuml'; // <--- 1. Importa la nueva librería


interface ParsedWebviewContent {
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
    private readonly md: MarkdownIt;
    private _loadingMessage = 'Contactando con Ollama...';

    // 2. Modifica el método `reveal` para que acepte el nuevo mensaje
    public static reveal(extensionUri: vscode.Uri, title: string, loadingMessage: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (UnifiedResponseWebview.currentPanel) {
            UnifiedResponseWebview.currentPanel._panel.reveal(column);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'ollamaCodeResponse',
                title,
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'out')]
                }
            );
            UnifiedResponseWebview.currentPanel = new UnifiedResponseWebview(panel, extensionUri);
        }
        
        // 3. Establece el mensaje y muestra el estado de carga inicial
        UnifiedResponseWebview.currentPanel._loadingMessage = loadingMessage;
        UnifiedResponseWebview.currentPanel._panel.title = title;
        UnifiedResponseWebview.currentPanel.showLoading();
    }

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
        
        // 2. Configura MarkdownIt para que use el plugin de PlantUML
        this.md = new MarkdownIt({ html: true, linkify: true, typographer: true });
        this.md.use(plantuml); // <--- ¡Añade el plugin aquí!

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
        this._panel.webview.html = this._getHtmlForWebview(
            { thinking: '', markdownContent: '', codeBlocks: [] },
            true // isLoading = true
        );
    }

     /* [MODIFICADO] Procesa y muestra la respuesta final de Ollama.
     * @param fullResponse La respuesta completa y en bruto del servicio.
     */
    public showResponse(fullResponse: string) {
        const parsedContent = this.parseResponse(fullResponse);
        this._panel.webview.html = this._getHtmlForWebview(parsedContent);
    }
    
    /**
     * [MODIFICADO] Parsea la respuesta del LLM para separar el pensamiento, el contenido y los bloques de código.
     */
      private parseResponse(text: string): ParsedWebviewContent {
        const codeBlocks: { language: string; code: string }[] = [];
        let thinking = "El modelo no proporcionó una cadena de pensamiento explícita.";
        let content = typeof text === 'string' ? text : '';

        // Extraer el pensamiento <think>...</think>
        const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch && thinkMatch[1]) {
            thinking = thinkMatch[1].trim();
            content = content.replace(thinkMatch[0], '').trim();
        }
        
        // 5. MODIFICACIÓN: La librería markdown-it-plantuml necesita los bloques intactos.
        // Así que simplemente pasamos todo el contenido para que el renderizador lo procese.
        // La extracción manual de bloques de código se puede mantener para copiar/pegar.
        content.replace(/```(\w*)\s*([\s\S]*?)```/g, (match, language, code) => {
            codeBlocks.push({ language: language || 'plaintext', code: code.trim() });
            return ''; // No modificamos el contenido principal
        });

        return { thinking, markdownContent: content, codeBlocks };
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

   // En: src/ui/webviews.ts

private _getHtmlForWebview(data: ParsedWebviewContent, isLoading = false): string {
        const { thinking, markdownContent, codeBlocks } = data;
        const nonce = getNonce();
        const styleUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview.css'));
        const scriptUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview.js'));

    let bodyContent: string;

    if (isLoading) {
        // --- CORRECCIÓN ---
        // HTML específico para el estado de carga
        bodyContent = `
           <div class="loading-container">
                        <h2>${this._loadingMessage}</h2>
                        <p>(Espera...)</p>
                        <div class="spinner"></div>
                    </div>
        `;
    } else {
        // HTML para mostrar la respuesta final
        let renderedContent = this.md.render(markdownContent);

        // Se reemplazan los marcadores de posición con los bloques de código HTML
         codeBlocks.forEach((block) => {
             // Evitamos renderizar bloques plantuml dos veces
            if (block.language !== 'plantuml') {
                const codeHtml = `
                    <div class="code-container">
                        <div class="code-header">
                            <span>${escape(block.language)}</span>
                            <button class="copy-btn" data-code="${escape(block.code)}">Copiar</button>
                        </div>
                        <pre><code>${escape(block.code)}</code></pre>
                    </div>`;
                // Se reemplaza un marcador si lo hubieras, o simplemente se añade al final.
                // Para este ejemplo, asumimos que se añade al contenido.
                renderedContent += codeHtml;
            }
        });

        bodyContent = `
            <details class="thinking-details">
                <summary>Ver Pensamiento del Modelo</summary>
                <div class="thinking-content">
                    <pre><code>${escape(thinking)}</code></pre>
                </div>
            </details>
            <div class="response-content">
                        ${this.md.render(markdownContent)}
                    </div>
        `;
    }

    return `<!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource}; script-src 'nonce-${nonce}';">
            <title>Respuesta de Ollama</title>
            <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
            ${bodyContent}
            <script nonce="${nonce}" src="${scriptUri}"></script>
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