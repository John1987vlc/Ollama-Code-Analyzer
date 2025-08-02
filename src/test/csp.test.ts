
import * as assert from 'assert';
import * as vscode from 'vscode';
import { getWebviewHtml } from '../ui/webviewsContent';
import { ParsedWebviewContent, UmlProgressState } from '../ui/webviewsTypes';

suite('CSP Test Suite', () => {
    test('getWebviewHtml should generate correct URIs for main.js and webview.css', () => {
        const panel = {
            webview: {
                asWebviewUri: (uri: vscode.Uri) => {
                    // Simulate the asWebviewUri method by replacing the scheme with 'vscode-webview-resource'
                    return uri.with({ scheme: 'vscode-webview-resource' });
                },
                cspSource: 'vscode-webview-resource:'
            }
        } as vscode.WebviewPanel;
        const extensionUri = vscode.Uri.file('C:/gemma3n-codeassistant');
        const data: ParsedWebviewContent = {
            thinking: '',
            markdownContent: '',
            codeBlocks: []
        };
        const umlProgressState: UmlProgressState = {
            processedFiles: [],
            remainingFiles: 0
        };
        const loadingMessage = '';
        const md = {
            render: (content: string) => content
        };

        const html = getWebviewHtml(panel, extensionUri, data, umlProgressState, loadingMessage, md, false, false);

        // Check for the presence of the correct URIs for main.js and webview.css
        assert.ok(
            html.includes('vscode-webview-resource:/c%3A/gemma3n-codeassistant/src/ui/media/main.js'),
            'Should contain correct URI for main.js'
        );
        assert.ok(
            html.includes('vscode-webview-resource:/c%3A/gemma3n-codeassistant/src/ui/media/webview.css'),
            'Should contain correct URI for webview.css'
        );
    });
});
