/**
 * @file Utilidades para la gestión de rutas de archivos.
 * Contiene funciones para normalizar rutas y obtener la ruta relativa
 * de un archivo dentro del espacio de trabajo.
 */
// src/utils/pathUtils.ts 

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Obtiene la ruta relativa de un archivo con respecto a la carpeta raíz del espacio de trabajo.
 * Normaliza las barras invertidas a barras diagonales para consistencia entre sistemas operativos.
 * * @param uri El URI del archivo del cual se quiere obtener la ruta relativa.
 * @returns La ruta relativa como string (ej: 'src/services/CodeAnalyzer.ts'), o null si el archivo no pertenece a ningún workspace.
 */
export function getRelativeFilePath(uri: vscode.Uri): string | null {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    
    // Si el archivo no está dentro de una carpeta de trabajo abierta, no podemos obtener una ruta relativa.
    if (!workspaceFolder) {
        return null;
    }

    // Calcula la ruta relativa desde la raíz del workspace hasta el archivo.
    const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    
    // Reemplaza las barras invertidas (\) por barras diagonales (/) para un formato uniforme.
    return relativePath.replace(/\\/g, '/');
}