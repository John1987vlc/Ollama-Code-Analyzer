// src/utils/Logger.ts
import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;

    public static initialize(channelName: string) {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel(channelName);
        }
    }

    public static log(message: string, ...optionalParams: any[]) {
        if (!this.outputChannel) {
            console.log(message, ...optionalParams);
            return;
        }
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] [INFO] ${message}`);
        if (optionalParams.length > 0) {
            optionalParams.forEach(param => {
                const paramStr = typeof param === 'object' ? JSON.stringify(param, null, 2) : String(param);
                this.outputChannel.appendLine(paramStr);
            });
        }
    }

    public static error(message: string, error?: any) {
        if (!this.outputChannel) {
            console.error(message, error);
            return;
        }
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] [ERROR] ${message}`);
        if (error) {
            if (error instanceof Error) {
                this.outputChannel.appendLine(`[ERROR] Name: ${error.name}`);
                this.outputChannel.appendLine(`[ERROR] Message: ${error.message}`);
                if (error.stack) {
                    this.outputChannel.appendLine(`[ERROR] Stack: ${error.stack}`);
                }
            } else if (typeof error === 'object') {
                this.outputChannel.appendLine(`[ERROR] Details: ${JSON.stringify(error, null, 2)}`);
            } else {
                this.outputChannel.appendLine(`[ERROR] Details: ${String(error)}`);
            }
        }
    }

    public static show() {
        if (this.outputChannel) {
            this.outputChannel.show(true); // El 'true' enfoca el panel
        }
    }
}