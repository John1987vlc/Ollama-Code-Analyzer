// src/ui/webviews.ts
import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
const kroki = require('@kazumatu981/markdown-it-kroki');



interface ParsedWebviewContent {
    thinking: string;
    markdownContent: string;
    codeBlocks: { language: string; code: string }[];
}

// Interfaz para el estado de progreso de UML
interface UmlProgressState {
    processedFiles: { path: string; components: string }[];
    remainingFiles: number;
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
    private _umlProgressState: UmlProgressState = { processedFiles: [], remainingFiles: 0 };


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
                    localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'out'), vscode.Uri.joinPath(extensionUri, 'media')]
                }
            );
            UnifiedResponseWebview.currentPanel = new UnifiedResponseWebview(panel, extensionUri);
        }

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

        // [CAMBIO] Usamos el nuevo plugin de Kroki
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
    
    /**
     * [NUEVO] Muestra el estado de carga inicial para la generación de UML.
     */
    public showUmlInitialLoading(totalFiles: number) {
        this._umlProgressState = { processedFiles: [], remainingFiles: totalFiles };
        this._loadingMessage = 'Analizando archivos para generar diagrama UML...';
        this._panel.webview.html = this._getHtmlForWebview(
            { thinking: '', markdownContent: '', codeBlocks: [] },
            true,
            true // isUmlGeneration
        );
    }

    /**
     * [NUEVO] Actualiza la vista web con el progreso del análisis de archivos UML.
     * @param filePath La ruta del archivo que acaba de ser procesado.
     * @param components Un resumen de los componentes encontrados (clases/métodos).
     */
    public showUmlGenerationProgress(filePath: string, components: string) {
        this._umlProgressState.processedFiles.push({ path: filePath, components });
        this._umlProgressState.remainingFiles--;
        
        this._panel.webview.html = this._getHtmlForWebview(
            { thinking: '', markdownContent: '', codeBlocks: [] },
            true, // Sigue en estado de carga
            true  // Es generación UML
        );
    }

    public showLoading() {
        this._panel.webview.html = this._getHtmlForWebview({ thinking: '', markdownContent: '', codeBlocks: [] }, true);
    }

     public showResponse(fullResponse: string, debugData?: any) {
        const parsedContent = this.parseResponse(fullResponse);
        if (debugData) {
            // Añadimos los datos de depuración al "pensamiento" para que se muestren.
            const debugJson = JSON.stringify(debugData, null, 2);
            parsedContent.thinking = `**Datos enviados al modelo para la síntesis final:**\n\n\`\`\`json\n${debugJson}\n\`\`\``;
        }
        this._panel.webview.html = this._getHtmlForWebview(parsedContent);
    }

   private parseResponse(text: string): ParsedWebviewContent {
        const codeBlocks: { language: string; code: string }[] = [];
        let thinking = "El modelo no proporcionó una cadena de pensamiento explícita.";
        let content = typeof text === 'string' ? text : '';

        const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch && thinkMatch[1]) {
            thinking = thinkMatch[1].trim();
            // Eliminamos el bloque de pensamiento del contenido principal
            content = content.replace(thinkMatch[0], '').trim();
        }
        
        // La expresión regular que eliminaba los bloques de código ha sido eliminada.
        // Ahora 'content' conserva el bloque ```plantuml para que sea renderizado.

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

     private _getHtmlForWebview(data: ParsedWebviewContent, isLoading = false, isUmlGeneration = false): string {
        const { thinking, markdownContent } = data;
        const nonce = getNonce();
        const styleUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css'));
        const scriptUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

        let bodyContent: string;

        if (isLoading) {
            if (isUmlGeneration) {
                // HTML para la carga de UML
                const processedFilesHtml = this._umlProgressState.processedFiles.map(file => `
                    <li class="processed-file">
                        <span class="icon">✔️</span>
                        <span class="path">${escape(file.path)}</span>
                        <span class="components">${escape(file.components)}</span>
                    </li>
                `).join('');

                bodyContent = `
                    <div class="loading-container">
                        <h2>${this._loadingMessage}</h2>
                        <p>Analizados ${this._umlProgressState.processedFiles.length} de ${this._umlProgressState.processedFiles.length + this._umlProgressState.remainingFiles} archivos.</p>
                        <div class="spinner"></div>
                        <ul class="progress-list">${processedFilesHtml}</ul>
                    </div>`;
            } else {
                // HTML para la carga genérica
                bodyContent = `
                   <div class="loading-container">
                        <h2>${this._loadingMessage}</h2>
                        <p>(Espera...)</p>
                        <div class="spinner"></div>
                    </div>`;
            }
        } else {
            // HTML para mostrar la respuesta final
            bodyContent = `
                <details class="thinking-details">
                    <summary>Ver Pensamiento del Modelo</summary>
                    <div class="thinking-content"><pre><code>${escape(thinking)}</code></pre></div>
                </details>
                <div class="response-content">${this.md.render(markdownContent)}</div>
            `;
        }

      return `<!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="
                    default-src 'none'; 
                    style-src ${this._panel.webview.cspSource}; 
                    script-src 'nonce-${nonce}'; 
                    /* [CAMBIO] Permitimos imágenes desde el servidor de kroki.io */
                    img-src ${this._panel.webview.cspSource} https://kroki.io;
                ">
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
    if (typeof htmlStr !== 'string') return '';
    return htmlStr.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}