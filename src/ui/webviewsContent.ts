// src/ui/webviewsContent.ts (VERSIÓN FINAL)

import * as vscode from 'vscode';
import { getNonce, escape } from '../utils/webviewUtils';
import { ParsedWebviewContent, UmlProgressState } from './webviewsTypes';

export function getWebviewHtml(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    data: ParsedWebviewContent,
    umlProgressState: UmlProgressState,
    loadingMessage: string,
    md: any,
    isLoading = false,
    isUmlGeneration = false
): string {
    const nonce = getNonce();
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.css'));
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));

    const { thinking, markdownContent } = data;
    let bodyContent: string;

    if (isLoading) {
        // --- LOADER ANIMADO (GENÉRICO Y UML) ---
        let umlProgressHtml = '';
        if (isUmlGeneration) {
             const totalFiles = umlProgressState.processedFiles.length + umlProgressState.remainingFiles;
             umlProgressHtml = `<p>Analizados ${umlProgressState.processedFiles.length} de ${totalFiles} archivos...</p>`;
        }

        bodyContent = `
            <div class="loader-container">
                <h1 class="loader-title">${escape(loadingMessage)}</h1>
                <p class="loader-subtitle">Procesando con Gemma3...</p>
                <div class="pulsing-loader">
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
                ${umlProgressHtml}
            </div>`;
    } else {
        // --- DISEÑO DE RESPUESTA FINAL ---
        bodyContent = `
            <div class="response-container">
                <details class="details-container">
                    <summary class="details-summary">🧠 Ver Pensamiento del Modelo</summary>
                    <div class="details-content">
                        <pre><code>${escape(thinking)}</code></pre>
                    </div>
                </details>
                <div class="markdown-body">
                    ${md.render(markdownContent)}
                </div>
            </div>`;
    }

    // --- HTML FINAL CON CSP CORRECTA ---
    return `<!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                style-src ${panel.webview.cspSource};
                script-src 'nonce-${nonce}';
                img-src ${panel.webview.cspSource} https://kroki.io;
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