// src/context/ExtensionContext.ts
import * as vscode from 'vscode';
import { OllamaService } from '../api/OllamaService';
import { GiteaService } from '../api/GiteaService';
import { CodeAnalyzer } from '../services/CodeAnalyzer';
import { GitContextAnalyzer } from '../services/GitContextAnalyzer';
import { PromptingService } from '../services/PromptingService';
import { GitContextTreeProvider } from '../providers/GitContextTreeProvider';
import { RefactorProvider } from '../providers/RefactorProvider';

/**
 * Contenedor central para todos los servicios y proveedores de la extensión.
 * Se encarga de la inicialización y la inyección de dependencias.
 */
export class CoreExtensionContext {
    public readonly ollamaService: OllamaService;
    public readonly giteaService: GiteaService;
    public readonly promptingService: PromptingService;
    public readonly codeAnalyzer: CodeAnalyzer;
    public readonly gitContextAnalyzer: GitContextAnalyzer;
    public readonly gitContextProvider: GitContextTreeProvider;
    public readonly refactorProvider: RefactorProvider;
    public readonly diagnosticCollection: vscode.DiagnosticCollection;

    constructor(private vsCodeContext: vscode.ExtensionContext) {
        // Inicialización de servicios sin dependencias cruzadas directas
        this.promptingService = new PromptingService();
        this.ollamaService = new OllamaService();
        this.giteaService = new GiteaService();

        // Servicios que dependen de otros servicios
        this.codeAnalyzer = new CodeAnalyzer(this.ollamaService);
        this.gitContextAnalyzer = new GitContextAnalyzer(this.giteaService, this.ollamaService);

        // Proveedores
        this.gitContextProvider = new GitContextTreeProvider(this.giteaService);
        
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ollama-refactor');
        this.refactorProvider = new RefactorProvider(this, this.diagnosticCollection);
    }

    /**
     * Registra todos los componentes desechables en el contexto de la extensión.
     */
    public dispose() {
        this.codeAnalyzer.dispose();
        this.diagnosticCollection.dispose();
    }
}