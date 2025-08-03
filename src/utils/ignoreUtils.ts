/**
 * @file Utilidades para gestionar la exclusión de archivos.
 * Construye un patrón de exclusión para las búsquedas de archivos en el
 * proyecto, combinando patrones por defecto, del `.gitignore` y de la
 * configuración de VS Code.
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

// Lista de patrones que se ignorarán por defecto en el análisis de UML.
const DEFAULT_IGNORE_PATTERNS = [
    '**/node_modules/**',
    '**/venv/**',
    '**/.venv/**',
    '**/env/**',
    '**/.env/**',
    '**/target/**',
    '**/build/**',
    '**/dist/**',
    '**/out/**',
    '**/.git/**',
    '**/site-packages/**',
    '**/*.egg-info/**'
];

/**
 * Construye un patrón glob de exclusión combinando patrones por defecto, 
 * del archivo .gitignore y de la configuración de VS Code.
 * @param workspaceRoot La URI de la carpeta raíz del espacio de trabajo.
 * @returns Un string con el patrón glob para el parámetro 'exclude' de findFiles.
 */
export async function getExcludePattern(workspaceRoot: vscode.Uri): Promise<string> {
    const allPatterns = new Set<string>(DEFAULT_IGNORE_PATTERNS);

    // 1. Leer patrones del archivo .gitignore si existe.
    try {
        const gitignorePath = path.join(workspaceRoot.fsPath, '.gitignore');
        const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
        const gitignorePatterns = gitignoreContent.split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));

        gitignorePatterns.forEach(pattern => {
            // Convierte patrones de .gitignore a glob. Esta es una conversión simple.
            // Elimina las barras iniciales/finales para un tratamiento uniforme.
            const cleanPattern = pattern.replace(/^\/|\/$/g, '');
            if (cleanPattern) {
                 allPatterns.add(`**/${cleanPattern}/**`); // Ignorar carpetas
                 allPatterns.add(`**/${cleanPattern}`);   // Ignorar archivos
            }
        });
    } catch (error) {
        // Es normal si el archivo .gitignore no existe.
    }

    // 2. Leer patrones de la configuración de VS Code (files.exclude).
    const config = vscode.workspace.getConfiguration('files');
    const excludeConfig = config.get<Record<string, boolean>>('exclude');
    if (excludeConfig) {
        for (const pattern in excludeConfig) {
            if (excludeConfig[pattern]) {
                allPatterns.add(pattern);
            }
        }
    }

    // Combina todos los patrones en un único glob pattern para la API de VS Code.
    return `{${Array.from(allPatterns).join(',')}}`;
}