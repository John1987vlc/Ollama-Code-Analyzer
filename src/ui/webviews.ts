/**
 * @file Gestiona la creación y el contenido de las Webviews.
 * Define la clase `UnifiedResponseWebview` que se utiliza para mostrar
 * respuestas de Ollama, estados de carga y diagramas UML,
 * manejando también la comunicación entre la webview y la extensión.
 */
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
            UnifiedResponseWebview.currentPanel.showLoading(); // <-- AÑADIDO: Muestra el loader al revelar
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
        UnifiedResponseWebview.currentPanel.showLoading(); // <-- AÑADIDO: Muestra el loader al crear
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
                // HTML para la carga de UML con animación Lottie
                const processedFilesHtml = this._umlProgressState.processedFiles.map(file => `
                    <li class="processed-file">
                        <span class="icon">✔️</span>
                        <span class="path">${escape(file.path)}</span>
                        <span class="components">${escape(file.components)}</span>
                    </li>
                `).join('');

                bodyContent = `
                    <div class="loading-container gemma-theme">
                        <div class="gemma-loader-wrapper">
                            <div id="gemma-lottie-animation"></div>
                            <div class="gemma-glow"></div>
                        </div>
                        <h2 class="loading-title">${this._loadingMessage}</h2>
                        <div class="progress-info">
                            <div class="progress-bar-container">
                                <div class="progress-bar" style="width: ${((this._umlProgressState.processedFiles.length) / (this._umlProgressState.processedFiles.length + this._umlProgressState.remainingFiles)) * 100}%"></div>
                            </div>
                            <p class="progress-text">Analizados ${this._umlProgressState.processedFiles.length} de ${this._umlProgressState.processedFiles.length + this._umlProgressState.remainingFiles} archivos</p>
                        </div>
                        <ul class="progress-list">${processedFilesHtml}</ul>
                    </div>`;
            } else {
                // HTML para la carga genérica con animación Lottie
                bodyContent = `
                    <div class="loading-container gemma-theme">
                        <div class="gemma-loader-wrapper">
                            <div id="gemma-lottie-animation"></div>
                            <div class="gemma-glow"></div>
                        </div>
                        <h2 class="loading-title">${this._loadingMessage}</h2>
                        <p class="loading-subtitle">Procesando con Gemma3...</p>
                        <div class="gemma-pulse-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
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
                    style-src ${this._panel.webview.cspSource} 'unsafe-inline'; 
                    script-src 'nonce-${nonce}' https://unpkg.com; 
                    img-src ${this._panel.webview.cspSource} https://kroki.io data:;
                    connect-src https://assets3.lottiefiles.com;
                ">
                <title>Respuesta de Ollama</title>
                <link href="${styleUri}" rel="stylesheet">
                <style nonce="${nonce}">
                    /* Estilos específicos para la animación Gemma3 */
                    .gemma-theme {
                        background: linear-gradient(135deg, #0f1419 0%, #1a1f2e 50%, #0f1419 100%);
                        min-height: 100vh;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        position: relative;
                        overflow: hidden;
                    }

                    .gemma-theme::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: radial-gradient(circle at 30% 70%, rgba(78, 205, 196, 0.1) 0%, transparent 50%),
                                    radial-gradient(circle at 70% 30%, rgba(255, 107, 107, 0.08) 0%, transparent 50%);
                        pointer-events: none;
                    }

                    .gemma-loader-wrapper {
                        position: relative;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: 2rem;
                    }

                    #gemma-lottie-animation {
                        width: 120px;
                        height: 120px;
                        filter: drop-shadow(0 0 20px rgba(78, 205, 196, 0.3));
                    }

                    .gemma-glow {
                        position: absolute;
                        width: 140px;
                        height: 140px;
                        border-radius: 50%;
                        background: radial-gradient(circle, rgba(78, 205, 196, 0.2) 0%, transparent 70%);
                        animation: gemma-pulse 2s ease-in-out infinite;
                    }

                    @keyframes gemma-pulse {
                        0%, 100% {
                            transform: scale(1);
                            opacity: 0.6;
                        }
                        50% {
                            transform: scale(1.1);
                            opacity: 1;
                        }
                    }

                    .loading-title {
                        color: #4ECDCC;
                        font-size: 1.5rem;
                        font-weight: 600;
                        margin: 0 0 0.5rem 0;
                        text-align: center;
                        text-shadow: 0 0 10px rgba(78, 205, 196, 0.3);
                    }

                    .loading-subtitle {
                        color: #8892b0;
                        font-size: 1rem;
                        margin: 0 0 2rem 0;
                        text-align: center;
                    }

                    .gemma-pulse-dots {
                        display: flex;
                        gap: 8px;
                        margin-bottom: 2rem;
                    }

                    .gemma-pulse-dots span {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: linear-gradient(45deg, #4ECDCC, #FF6B6B);
                        animation: gemma-dot-pulse 1.4s ease-in-out infinite both;
                    }

                    .gemma-pulse-dots span:nth-child(1) { animation-delay: -0.32s; }
                    .gemma-pulse-dots span:nth-child(2) { animation-delay: -0.16s; }
                    .gemma-pulse-dots span:nth-child(3) { animation-delay: 0s; }

                    @keyframes gemma-dot-pulse {
                        0%, 80%, 100% {
                            transform: scale(0);
                            opacity: 0.5;
                        }
                        40% {
                            transform: scale(1);
                            opacity: 1;
                        }
                    }

                    .progress-info {
                        width: 100%;
                        max-width: 400px;
                        margin-bottom: 2rem;
                    }

                    .progress-bar-container {
                        width: 100%;
                        height: 4px;
                        background: rgba(136, 146, 176, 0.2);
                        border-radius: 2px;
                        overflow: hidden;
                        margin-bottom: 0.5rem;
                    }

                    .progress-bar {
                        height: 100%;
                        background: linear-gradient(90deg, #4ECDCC, #FF6B6B);
                        border-radius: 2px;
                        transition: width 0.3s ease;
                        position: relative;
                    }

                    .progress-bar::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: -100%;
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
                        animation: shimmer 2s infinite;
                    }

                    @keyframes shimmer {
                        0% { left: -100%; }
                        100% { left: 100%; }
                    }

                    .progress-text {
                        color: #8892b0;
                        font-size: 0.9rem;
                        text-align: center;
                        margin: 0;
                    }

                    .progress-list {
                        list-style: none;
                        padding: 0;
                        margin: 0;
                        max-width: 500px;
                        max-height: 200px;
                        overflow-y: auto;
                        background: rgba(15, 20, 25, 0.6);
                        border-radius: 8px;
                        padding: 1rem;
                        backdrop-filter: blur(10px);
                    }

                    .processed-file {
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        padding: 0.5rem 0;
                        border-bottom: 1px solid rgba(136, 146, 176, 0.1);
                        animation: fadeInUp 0.3s ease;
                    }

                    .processed-file:last-child {
                        border-bottom: none;
                    }

                    .processed-file .icon {
                        flex-shrink: 0;
                    }

                    .processed-file .path {
                        color: #4ECDCC;
                        font-family: monospace;
                        font-size: 0.8rem;
                        flex: 1;
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .processed-file .components {
                        color: #8892b0;
                        font-size: 0.7rem;
                        opacity: 0.8;
                    }

                    @keyframes fadeInUp {
                        from {
                            opacity: 0;
                            transform: translateY(10px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }

                    /* Personalización del scrollbar */
                    .progress-list::-webkit-scrollbar {
                        width: 6px;
                    }

                    .progress-list::-webkit-scrollbar-track {
                        background: rgba(136, 146, 176, 0.1);
                        border-radius: 3px;
                    }

                    .progress-list::-webkit-scrollbar-thumb {
                        background: linear-gradient(180deg, #4ECDCC, #FF6B6B);
                        border-radius: 3px;
                    }
                </style>
            </head>
            <body>
                ${bodyContent}
                <script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js" nonce="${nonce}"></script>
                <script nonce="${nonce}">
                    // Animación Lottie personalizada para Gemma3
                    if (document.getElementById('gemma-lottie-animation')) {
                        // Creamos una animación personalizada con código SVG
                        const lottieContainer = document.getElementById('gemma-lottie-animation');
                        lottieContainer.innerHTML = \`
                            <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="gemmaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" style="stop-color:#4ECDCC;stop-opacity:1" />
                                        <stop offset="100%" style="stop-color:#FF6B6B;stop-opacity:1" />
                                    </linearGradient>
                                    <filter id="glow">
                                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                        <feMerge> 
                                            <feMergeNode in="coloredBlur"/>
                                            <feMergeNode in="SourceGraphic"/> 
                                        </feMerge>
                                    </filter>
                                </defs>
                                
                                <!-- Círculo exterior rotando -->
                                <circle cx="60" cy="60" r="45" fill="none" stroke="url(#gemmaGradient)" stroke-width="2" stroke-dasharray="10,5" opacity="0.6" filter="url(#glow)">
                                    <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 60 60" to="360 60 60" dur="4s" repeatCount="indefinite"/>
                                </circle>
                                
                                <!-- Círculo medio rotando en sentido contrario -->
                                <circle cx="60" cy="60" r="35" fill="none" stroke="url(#gemmaGradient)" stroke-width="1.5" stroke-dasharray="8,3" opacity="0.8">
                                    <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="360 60 60" to="0 60 60" dur="3s" repeatCount="indefinite"/>
                                </circle>
                                
                                <!-- Logo central estilizado (representando Gemma) -->
                                <g transform="translate(60,60)">
                                    <!-- Núcleo central pulsante -->
                                    <circle cx="0" cy="0" r="15" fill="url(#gemmaGradient)" opacity="0.9" filter="url(#glow)">
                                        <animate attributeName="r" values="15;18;15" dur="2s" repeatCount="indefinite"/>
                                        <animate attributeName="opacity" values="0.9;1;0.9" dur="2s" repeatCount="indefinite"/>
                                    </circle>
                                    
                                    <!-- Elementos decorativos tipo "gemas" -->
                                    <g>
                                        <polygon points="-8,-8 8,-8 12,-4 8,8 -8,8 -12,-4" fill="url(#gemmaGradient)" opacity="0.7" filter="url(#glow)">
                                            <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 0 0" to="360 0 0" dur="6s" repeatCount="indefinite"/>
                                            <animate attributeName="opacity" values="0.7;0.9;0.7" dur="2s" repeatCount="indefinite"/>
                                        </polygon>
                                    </g>
                                    
                                    <!-- Partículas flotantes -->
                                    <circle cx="20" cy="-10" r="2" fill="#4ECDCC" opacity="0.8">
                                        <animate attributeName="cy" values="-10;-15;-10" dur="1.5s" repeatCount="indefinite"/>
                                        <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite"/>
                                    </circle>
                                    <circle cx="-18" cy="12" r="1.5" fill="#FF6B6B" opacity="0.8">
                                        <animate attributeName="cy" values="12;17;12" dur="1.8s" repeatCount="indefinite"/>
                                        <animate attributeName="opacity" values="0.8;1;0.8" dur="1.8s" repeatCount="indefinite"/>
                                    </circle>
                                    <circle cx="15" cy="18" r="1" fill="#4ECDCC" opacity="0.6">
                                        <animate attributeName="cy" values="18;23;18" dur="2.2s" repeatCount="indefinite"/>
                                        <animate attributeName="opacity" values="0.6;1;0.6" dur="2.2s" repeatCount="indefinite"/>
                                    </circle>
                                </g>
                            </svg>
                        \`;
                    }
                </script>
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