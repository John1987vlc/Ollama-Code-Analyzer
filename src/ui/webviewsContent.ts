import * as vscode from 'vscode';
import { getNonce, escape } from '../utils/webviewUtils';
import { ParsedWebviewContent, UmlProgressState } from './webviewsTypes';

import { I18n } from '../internationalization/i18n';

export function getWebviewHtml(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    data: ParsedWebviewContent,
    umlProgressState: UmlProgressState,
    loadingMessage: string,
    md: any,
    isLoading = false,
    isUmlGeneration = false,
    referencedFilesTitle: string | undefined,
    i18n: any
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
                 <p class="progress-summary">${i18n.umlProgress.replace('{0}', umlProgressState.processedFiles.length).replace('{1}', totalFiles)}</p>
                 <div class="processed-files-list">
                     <h4>${i18n.analyzedFiles}</h4>
                     <ul>
                         ${processedFilesList}
                     </ul>
                 </div>
                 <div class="remaining-files-info">
                     <p class="current-analysis">${i18n.currentlyAnalyzing}</p>
                     <p class="remaining-count">${i18n.remainingFiles.replace('{0}', umlProgressState.remainingFiles)}</p>
                 </div>
             </div>`;
        }

         bodyContent = `
        <div class="loader-container" role="status" aria-live="polite">
            <h1 class="loader-title">${escape(loadingMessage)}</h1>

            <!-- Fallback robusto: pulsing loader -->
            <div class="pulsing-loader" aria-label="${i18n.loaderAriaLabel}">
                <div></div><div></div><div></div>
            </div>
            ${umlProgressHtml}
        </div>`;
    } else {
        // --- DISEÑO DE RESPUESTA FINAL (sin cambios) ---
        bodyContent = `
            <div class="response-container">
                <details class="details-container">
                    <summary class="details-summary">${i18n.thinking}</summary>
                    <div class="details-content">
                        <pre><code>${escape(thinking)}</code></pre>
                    </div>
                </details>
                <div class="markdown-body">
                    ${isUmlGeneration ? 
                        `<div class="diagrama-uml">${markdownContent}</div>` : 
                        md.render(markdownContent)
                    }
                </div>
            </div>`;
    }

    console.log('getWebviewHtml bodyContent:', bodyContent);

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
        <title>${i18n.panelTitle}</title>
        <link href="${styleUri}" rel="stylesheet">
        <script>
            const vscode = acquireVsCodeApi();
            const i18n = ${JSON.stringify(i18n)};
            
             // Global error handler to catch resource loading failures
    window.addEventListener('error', (event) => {
      if (event.target && (event.target.src || event.target.href)) {
        const resourceUrl = event.target.src || event.target.href;
        vscode.postMessage({
          command: 'log',
          message: 'ERROR: Failed to load resource: ' + resourceUrl
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
        </script>
        ${bodyContent}
        <script src="${scriptUri}"></script>
    </body>
    </html>`;
}
