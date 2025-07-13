// src/ui/webviews.ts

import * as vscode from 'vscode';
import { AnalysisResult } from '../services/CodeAnalyzer'; // Asumiendo que quieres mostrar un resultado de análisis

/**
 * Gestiona la creación y el contenido de la vista web para el informe de análisis.
 */
export class AnalysisReportWebview {
    public static currentPanel: AnalysisReportWebview | undefined;

    public static readonly viewType = 'ollamaAnalysisReport';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Si ya tenemos un panel, lo mostramos.
        if (AnalysisReportWebview.currentPanel) {
            AnalysisReportWebview.currentPanel._panel.reveal(column);
            return;
        }

        // Si no, creamos un nuevo panel.
        const panel = vscode.window.createWebviewPanel(
            AnalysisReportWebview.viewType,
            'Informe de Análisis de Ollama',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true, // Habilitar JavaScript en la webview
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        AnalysisReportWebview.currentPanel = new AnalysisReportWebview(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Establecer el contenido HTML inicial
        this._panel.webview.html = this._getHtmlForWebview();

        // Limpiar recursos cuando el panel se cierra
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    /**
     * Envía los datos del análisis a la Webview para que los renderice.
     */
    public update(analysisResult: AnalysisResult) {
        this._panel.webview.postMessage({
            command: 'updateReport',
            data: analysisResult
        });
    }

    public dispose() {
        AnalysisReportWebview.currentPanel = undefined;

        // Limpiar nuestros recursos
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview(): string {
        const webview = this._panel.webview;

        // Aquí podrías tener tus propios archivos CSS y JS
        // const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        // const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css'));

        // Nonce para permitir solo scripts específicos
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Informe de Análisis</title>
            </head>
            <body>
                <h1>Informe de Análisis</h1>
                <p>Esperando datos del análisis...</p>

                <div id="summary"></div>
                <ul id="suggestions-list"></ul>

                </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}