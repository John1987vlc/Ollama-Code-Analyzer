/**
 * @file Utilidades para los comandos que operan a nivel de proyecto.
 * Contiene funciones para buscar archivos en el workspace, obtener las extensiones
 * de un lenguaje y manejar patrones de exclusión.
 */

import * as vscode from 'vscode';
import { getExcludePattern } from '../../utils/ignoreUtils';


export function getExtensionsForLanguage(languageId: string): string[] {
    const languageExtensionMap: Record<string, string[]> = {
        'csharp': ['.cs'],
        'javascript': ['.js', '.jsx'],
        'typescript': ['.ts', '.tsx'],
        'python': ['.py'],
        'java': ['.java'],
        'cpp': ['.cpp', '.hpp', '.h'],
        'c': ['.c', '.h'],
        'sql': ['.sql']
    };
    return languageExtensionMap[languageId] || [`.${languageId}`];
}

export async function findProjectFiles(rootUri: vscode.Uri): Promise<{ path: string, content: string }[]> {
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
    const supportedLanguages = config.get<string[]>('supportedLanguages', []);
    
    const allExtensions = supportedLanguages.flatMap(getExtensionsForLanguage);
    const uniqueExtensions = [...new Set(allExtensions)];

    if (uniqueExtensions.length === 0) {
        return [];
    }

    const includePattern = `**/*{${uniqueExtensions.join(',')}}`;
    const excludePattern = await getExcludePattern(rootUri);
    
    const files = await vscode.workspace.findFiles(includePattern, excludePattern);

    const fileContents = await Promise.all(
        files.map(async (uri) => {
            const document = await vscode.workspace.openTextDocument(uri);
            const relativePath = vscode.workspace.asRelativePath(uri, false);
            return {
                path: relativePath,
                content: document.getText()
            };
        })
    );
    return fileContents;
}