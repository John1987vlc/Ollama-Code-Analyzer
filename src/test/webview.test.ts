
import * as assert from 'assert';
import * as vscode from 'vscode';
import { getWebviewHtml } from '../ui/webviewsContent';
import { ParsedWebviewContent, UmlProgressState } from '../ui/webviewsTypes';

suite('Webview Content Test Suite', () => {
    test('getWebviewHtml should return loading HTML when isLoading is true', () => {
        const panel = {
            webview: {
                asWebviewUri: (uri: vscode.Uri) => uri,
                cspSource: 'self'
            }
        } as vscode.WebviewPanel;
        const extensionUri = vscode.Uri.file('/');
        const data: ParsedWebviewContent = {
            thinking: 'Thinking...',
            markdownContent: 'Markdown content',
            codeBlocks: []
        };
        const umlProgressState: UmlProgressState = {
            processedFiles: [],
            remainingFiles: 0
        };
        const loadingMessage = 'Loading...';
        const md = {
            render: (content: string) => content
        };

        const html = getWebviewHtml(panel, extensionUri, data, umlProgressState, loadingMessage, md, true, false, {
            copied: 'Copied!',
            thinking: 'Thinking...',
            umlProgress: 'Analyzed {0} of {1} files.',
            analyzedFiles: 'Analyzed Files:',
            currentlyAnalyzing: 'Currently analyzing...',
            remainingFiles: '{0} files remaining.',
            loaderAriaLabel: 'Loading',
            panelTitle: 'Ollama Response'
        });

        assert.ok(html.includes('<div class="loader-container"'), 'Should contain loader container');
        assert.ok(html.includes('<h1 class="loader-title">Loading...</h1>'), 'Should contain loader title');
    });

    test('getWebviewHtml should return content HTML when isLoading is false', () => {
        const panel = {
            webview: {
                asWebviewUri: (uri: vscode.Uri) => uri,
                cspSource: 'self'
            }
        } as vscode.WebviewPanel;
        const extensionUri = vscode.Uri.file('/');
        const data: ParsedWebviewContent = {
            thinking: 'Thinking...',
            markdownContent: 'Markdown content',
            codeBlocks: []
        };
        const umlProgressState: UmlProgressState = {
            processedFiles: [],
            remainingFiles: 0
        };
        const loadingMessage = 'Loading...';
        const md = {
            render: (content: string) => content
        };

        const html = getWebviewHtml(panel, extensionUri, data, umlProgressState, loadingMessage, md, false, false, {
            copied: 'Copied!',
            thinking: 'Thinking...',
            umlProgress: 'Analyzed {0} of {1} files.',
            analyzedFiles: 'Analyzed Files:',
            currentlyAnalyzing: 'Currently analyzing...',
            remainingFiles: '{0} files remaining.',
            loaderAriaLabel: 'Loading',
            panelTitle: 'Ollama Response'
        });

        assert.ok(html.includes('<div class="response-container"'), 'Should contain response container');
        assert.ok(html.includes('Markdown content'), 'Should contain markdown content');
    });

    test('getWebviewHtml should include correct CSP', () => {
        const panel = {
            webview: {
                asWebviewUri: (uri: vscode.Uri) => uri,
                cspSource: 'vscode-resource:'
            }
        } as vscode.WebviewPanel;
        const extensionUri = vscode.Uri.file('/');
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

        const html = getWebviewHtml(panel, extensionUri, data, umlProgressState, loadingMessage, md, false, false, {
            copied: 'Copied!',
            thinking: 'Thinking...',
            umlProgress: 'Analyzed {0} of {1} files.',
            analyzedFiles: 'Analyzed Files:',
            currentlyAnalyzing: 'Currently analyzing...',
            remainingFiles: '{0} files remaining.',
            loaderAriaLabel: 'Loading',
            panelTitle: 'Ollama Response'
        });

        assert.ok(
            html.includes(
                `<meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        style-src ${panel.webview.cspSource} https: 'unsafe-inline';
        script-src ${panel.webview.cspSource} https: 'unsafe-inline';
        img-src ${panel.webview.cspSource} https: data:;">`
            ),
            'CSP should allow https:'
        );
    });
});
