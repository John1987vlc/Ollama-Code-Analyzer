// src/utils/webviewUtils.ts

import { ParsedWebviewContent } from '../ui/webviewsTypes';

/**
 * Genera una cadena aleatoria para usar en la Política de Seguridad de Contenido (CSP).
 */
export function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Escapa caracteres HTML para prevenir XSS.
 */
export function escape(htmlStr: string): string {
    if (typeof htmlStr !== 'string') {return '';}
    return htmlStr.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Extrae el bloque <think> del texto de respuesta del modelo.
 */
export function parseResponse(text: string): ParsedWebviewContent {
    const codeBlocks: { language: string; code: string }[] = [];
    let thinking = "No thinking response.";
    let content = typeof text === 'string' ? text : '';

    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch && thinkMatch[1]) {
        thinking = thinkMatch[1].trim();
        content = content.replace(thinkMatch[0], '').trim();
    }
    
    return { thinking, markdownContent: content, codeBlocks };
}