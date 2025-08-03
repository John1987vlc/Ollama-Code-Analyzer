// src/internationalization/i18n.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

type Translations = { [key: string]: string };

export class I18n {
    private static instance: I18n;
    private translations: Translations = {};
    private currentLocale: string = 'en';
    private context: vscode.ExtensionContext; // Store the context
    private disposables: vscode.Disposable[] = []; // Store disposables

    private constructor(context: vscode.ExtensionContext) {
        this.context = context; // Assign context
        this.loadTranslations(this.context);
        this.updateLocale();
    }

    private loadTranslations(context: vscode.ExtensionContext): void {
        const defaultNlsPath = path.join(context.extensionPath, 'package.nls.json');
        const locale = vscode.env.language;
        const localeNlsPath = path.join(context.extensionPath, `package.nls.${locale}.json`);

        try {
            // Load default (English) translations
            const defaultContent = fs.readFileSync(defaultNlsPath, 'utf-8');
            this.translations = JSON.parse(defaultContent);

            // Load locale-specific translations and merge
            if (fs.existsSync(localeNlsPath)) {
                const localeContent = fs.readFileSync(localeNlsPath, 'utf-8');
                const localeTranslations = JSON.parse(localeContent);
                this.translations = { ...this.translations, ...localeTranslations };
            }
        } catch (error) {
            console.error("Failed to load translation files:", error);
            vscode.window.showErrorMessage('Critical Error: Could not load translation files.');
        }
    }

    public static initialize(context: vscode.ExtensionContext): void {
        if (!I18n.instance) {
            I18n.instance = new I18n(context);
        }
    }

    public static t(key: string, ...args: (string | number)[]): string {
        if (!I18n.instance) {
            console.error("I18n service not initialized.");
            return key;
        }
        let translated = this.instance.translations[key] || key;

        // Replace placeholders {0}, {1}, etc.
        args.forEach((arg, index) => {
            translated = translated.replace(new RegExp(`\{${index}\}`, 'g'), String(arg));
        });

        return translated;
    }
    
    private updateLocale(): void {
        this.currentLocale = vscode.env.language;
        this.loadTranslations(this.context); // Reload translations when locale changes
    }

    public dispose(): void {
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }}