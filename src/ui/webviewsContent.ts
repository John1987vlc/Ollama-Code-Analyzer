// src/ui/webviewsContent.ts

import * as vscode from 'vscode';
import { getNonce, escape } from '../utils/webviewUtils';
import { ParsedWebviewContent, UmlProgressState } from './webviewsTypes';

export function getWebviewHtml(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    data: ParsedWebviewContent,
    umlProgressState: UmlProgressState,
    loadingMessage: string,
    md: any, // Instancia de Markdown-it
    isLoading = false,
    isUmlGeneration = false
): string {
    const nonce = getNonce();

    // Genera URIs seguros para cargar los recursos locales
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.css'));
    const lottieUri = 'https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js';

    const { thinking, markdownContent } = data;
    let bodyContent: string;

    // ... (El resto de la lógica para bodyContent se mantiene igual) ...
    if (isLoading) {
        if (isUmlGeneration) {
            const processedFilesHtml = umlProgressState.processedFiles.map(file => `
                <li class="processed-file">
                    <span class="icon">✔️</span>
                    <span class="path">${escape(file.path)}</span>
                    <span class="components">${escape(file.components)}</span>
                </li>
            `).join('');
            const totalFiles = umlProgressState.processedFiles.length + umlProgressState.remainingFiles;
            const progressPercentage = totalFiles > 0 ? (umlProgressState.processedFiles.length / totalFiles) * 100 : 0;
            bodyContent = `
                <div class="loading-container gemma-theme">
                    <div class="gemma-loader-wrapper"><div id="gemma-lottie-animation"></div><div class="gemma-glow"></div></div>
                    <h2 class="loading-title">${loadingMessage}</h2>
                    <div class="progress-info">
                        <div class="progress-bar-container"><div class="progress-bar" style="width: ${progressPercentage}%"></div></div>
                        <p class="progress-text">Analizados ${umlProgressState.processedFiles.length} de ${totalFiles} archivos</p>
                    </div>
                    <ul class="progress-list">${processedFilesHtml}</ul>
                </div>`;
        } else {
            bodyContent = `
                <div class="loading-container gemma-theme">
                    <div class="gemma-loader-wrapper"><div id="gemma-lottie-animation"></div><div class="gemma-glow"></div></div>
                    <h2 class="loading-title">${loadingMessage}</h2>
                    <p class="loading-subtitle">Procesando con Gemma3...</p>
                    <div class="gemma-pulse-dots"><span></span><span></span><span></span></div>
                </div>`;
        }
    } else {
        bodyContent = `
            <div class="response-container gemma-response-theme">
                <div class="response-header">
                    <div class="gemma-brand">
                        <div class="gemma-icon"><svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#4ECDCC;stop-opacity:1" /><stop offset="100%" style="stop-color:#FF6B6B;stop-opacity:1" /></linearGradient></defs><circle cx="12" cy="12" r="8" fill="url(#brandGradient)" opacity="0.8"/><polygon points="8,8 16,8 18,10 16,16 8,16 6,10" fill="url(#brandGradient)" opacity="0.9"/></svg></div>
                        <span class="brand-text">Gemma3</span>
                    </div>
                    <div class="response-status"><span class="status-indicator"></span><span class="status-text">Respuesta completada</span></div>
                </div>
                <details class="thinking-details modern-accordion">
                    <summary class="thinking-summary">
                        <div class="summary-content">
                            <div class="summary-icon">🧠</div><span class="summary-text">Ver Pensamiento del Modelo</span>
                            <div class="summary-arrow"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4.427 9.573L8 6l3.573 3.573L10.5 10.5 8 8l-2.5 2.5z"/></svg></div>
                        </div>
                    </summary>
                    <div class="thinking-content modern-code-block">
                        <div class="code-header"><span class="code-title">Proceso de razonamiento</span><button class="copy-btn">...</button></div>
                        <pre class="thinking-code"><code>${escape(thinking)}</code></pre>
                    </div>
                </details>
                <div class="response-content modern-content"><div class="content-wrapper">${md.render(markdownContent)}</div></div>
                <div class="response-footer"><div class="powered-by">...</div></div>
            </div>`;
    }

    /// HTML FINAL
    return `<!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                style-src ${panel.webview.cspSource};
                
                // --- CORRECCIÓN AQUÍ ---
                script-src 'nonce-${nonce}' ${panel.webview.cspSource} https://unpkg.com; 

                img-src ${panel.webview.cspSource} https://kroki.io data:;
                connect-src https://assets3.lottiefiles.com;
            ">
            <title>Respuesta de Ollama</title>
            <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
            ${bodyContent}
            
            <script nonce="${nonce}" src="${lottieUri}"></script>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
}