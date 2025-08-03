import * as vscode from 'vscode';
import { getNonce } from '../utils/webviewUtils';

export function getTestWebviewHtml(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): string {
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'media', 'webview.css'));
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'media', 'main.js'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="
            default-src 'none';
            style-src ${panel.webview.cspSource} https: 'unsafe-inline';
            script-src ${panel.webview.cspSource} https: 'unsafe-inline';
            img-src ${panel.webview.cspSource} https: data:;">
        <title>Webview Resource Test</title>
        <link href="${styleUri}" rel="stylesheet" onerror="console.error('Failed to load webview.css: ' + this.href);">
    </head>
    <body>
        <h1>Webview Resource Test</h1>
        <p id="status">Checking resource loading...</p>
        <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();

            function log(message) {
                vscode.postMessage({ command: 'log', message: message });
                console.log(message); // Also log to the webview's console
            }

            document.addEventListener('DOMContentLoaded', () => {
                log('--- Webview Test Logs ---');
                log('Resolved styleUri: ${styleUri}');
                log('Resolved scriptUri: ${scriptUri}');

                const statusElement = document.getElementById('status');
                if (statusElement) {
                    statusElement.textContent = 'Webview loaded. Checking console for resource loading status.';
                }
            });
        </script>
        <script src="${scriptUri}" nonce="${nonce}" onerror="console.error('Failed to load main.js: ' + this.src);"></script>
    </body>
    </html>`;
}