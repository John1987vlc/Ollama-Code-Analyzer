// src/internationalization/i18n.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

type Translations = { [key: string]: string };

export class I18n {
    private static instance: I18n;
    private translations: { [locale: string]: Translations } = {};
    private currentLocale: string = 'en';

    private constructor(context: vscode.ExtensionContext) {
        // --- CORRECCIÓN AQUÍ ---
        // Usamos __dirname para construir la ruta desde la ubicación del archivo compilado (en 'out')
        const localesPath = path.resolve(__dirname, '..', 'internationalization', 'locales.json');
        
        try {
            const fileContent = fs.readFileSync(localesPath, 'utf-8');
            this.translations = JSON.parse(fileContent);
            this.updateLocale();

            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('ollamaCodeAnalyzer.outputLanguage')) {
                    this.updateLocale();
                }
            });
        } catch (error) {
            console.error("Failed to load translation files:", error);
            vscode.window.showErrorMessage('Error crítico: No se pudieron cargar los ficheros de traducción.');
        }
    }

    // ... (el resto de la clase no cambia) ...
    public static initialize(context: vscode.ExtensionContext): void {
        if (!I18n.instance) {
            I18n.instance = new I18n(context);
        }
    }

    public static t(key: string): string {
        if (!I18n.instance) {
            console.error("I18n service not initialized.");
            return key;
        }
        const localeTranslations = I18n.instance.translations[I18n.instance.currentLocale] || I18n.instance.translations['en'];
        return localeTranslations[key] || key;
    }
    
    private updateLocale(): void {
        const configLang = vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('outputLanguage');
        this.currentLocale = configLang === 'Español' ? 'es' : 'en';
    }
}