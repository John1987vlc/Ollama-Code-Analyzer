// src/ui/webviewsContent.ts (VERSIÓN CON LOADER DEL LOGO)

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
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'media', 'webview.css'));
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'media', 'main.js'));

    const { thinking, markdownContent } = data;
    let bodyContent: string;

    if (isLoading) {
        // --- HTML PARA EL NUEVO LOADER ---
        let umlProgressHtml = '';
        if (isUmlGeneration) {
             const totalFiles = umlProgressState.processedFiles.length + umlProgressState.remainingFiles;
             const processedFilesList = umlProgressState.processedFiles.map(file => `<li class="processed-file">${escape(file.path)}</li>`).join('');
             umlProgressHtml = `
             <div class="uml-progress-details">
                 <p class="progress-summary">Analizados ${umlProgressState.processedFiles.length} de ${totalFiles} archivos.</p>
                 <div class="processed-files-list">
                     <h4>Archivos Analizados:</h4>
                     <ul>
                         ${processedFilesList}
                     </ul>
                 </div>
                 <div class="remaining-files-info">
                     <p class="current-analysis">Actualmente analizando...</p>
                     <p class="remaining-count">${umlProgressState.remainingFiles} archivos pendientes.</p>
                 </div>
             </div>`;
        }

         bodyContent = `
        <div class="loader-container" role="status" aria-live="polite">
            <h1 class="loader-title">${escape(loadingMessage)}</h1>

            <!-- Fallback robusto: pulsing loader -->
            <div class="pulsing-loader" aria-label="Cargando">
                <div></div><div></div><div></div>
            </div>
            ${umlProgressHtml}
        </div>`;
    } else {
        // --- DISEÑO DE RESPUESTA FINAL (sin cambios) ---
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

  // --- HTML FINAL ---
return `<!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        style-src ${panel.webview.cspSource} https: 'unsafe-inline';
        script-src ${panel.webview.cspSource} https: 'unsafe-inline';
        img-src ${panel.webview.cspSource} https: data:;">
        <title>Respuesta de Ollama</title>
        <link href="${styleUri}" rel="stylesheet">
        <script>
            const vscode = acquireVsCodeApi();
            
            // Global error handler to catch resource loading failures
            window.addEventListener('error', (event) => {
                if (event.target && (event.target.src || event.target.href)) {
                    const resourceUrl = event.target.src || event.target.href;
                    vscode.postMessage({
                        command: 'log',
                        message: \`ERROR: Failed to load resource: \${resourceUrl}\`
                    });
                }
            }, true);

            // Centralized log function
            function log(message) {
                vscode.postMessage({ command: 'log', message });
            }
        </script>
    </head>
    <body>
        <script>
            log("--- GEMMA WEBVIEW LOGS ---");
            log("CSP source: ${panel.webview.cspSource}");
            log("Style URI: ${styleUri}");
            log("Script URI: ${scriptUri}");
            log("Initial isLoading state: ${isLoading}");
            log("--------------------------");
        </script>
        ${bodyContent}
        <script src="${scriptUri}"></script>
    </body>
    </html>`;
}