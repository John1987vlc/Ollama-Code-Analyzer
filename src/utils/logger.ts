// src/utils/Logger.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class Logger {
    private static outputChannel: vscode.OutputChannel;
    private static logFilePath: string;

    public static initialize(channelName: string) {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel(channelName);
        }
        // Define la ruta del archivo de log en el directorio de la extensión
        // Asegúrate de que el directorio 'logs' exista
                const extensionLogDir = path.join(vscode.extensions.getExtension('ollama-code-analyzer-Gemma3n.ollama-code-analyzer')!.extensionPath, 'logs');
        if (!fs.existsSync(extensionLogDir)) {
            fs.mkdirSync(extensionLogDir, { recursive: true });
        }
        this.logFilePath = path.join(extensionLogDir, 'extension.log');
    }

    private static writeToFile(message: string) {
        if (this.logFilePath) {
            fs.appendFileSync(this.logFilePath, message + '\n', 'utf-8');
        }
    }

    public static log(message: string, ...optionalParams: any[]) {
        const timestamp = new Date().toISOString();
        let logMessage = `[${timestamp}] [INFO] ${message}`;
        this.outputChannel?.appendLine(logMessage);
        this.writeToFile(logMessage);

        if (optionalParams.length > 0) {
            optionalParams.forEach(param => {
                const paramStr = typeof param === 'object' ? JSON.stringify(param, null, 2) : String(param);
                this.outputChannel?.appendLine(paramStr);
                this.writeToFile(paramStr);
            });
        }
    }

    public static error(message: string, error?: any) {
        const timestamp = new Date().toISOString();
        let errorMessage = `[${timestamp}] [ERROR] ${message}`;
        this.outputChannel?.appendLine(errorMessage);
        this.writeToFile(errorMessage);

        if (error) {
            let errorDetails = '';
            if (error instanceof Error) {
                errorDetails += `[ERROR] Name: ${error.name}\n`;
                errorDetails += `[ERROR] Message: ${error.message}\n`;
                if (error.stack) {
                    errorDetails += `[ERROR] Stack: ${error.stack}\n`;
                }
            } else if (typeof error === 'object') {
                errorDetails += `[ERROR] Details: ${JSON.stringify(error, null, 2)}\n`;
            } else {
                errorDetails += `[ERROR] Details: ${String(error)}\n`;
            }
            this.outputChannel?.appendLine(errorDetails);
            this.writeToFile(errorDetails);
        }
    }

    public static show() {
        if (this.outputChannel) {
            this.outputChannel.show(true); // El 'true' enfoca el panel
        }
    }
}
