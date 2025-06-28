import * as vscode from 'vscode';
import { OllamaService } from './services/OllamaService';
import { CodeAnalyzer } from './services/CodeAnalyzer';
import { GiteaService } from './services/GiteaService';
import { GitContextAnalyzer } from './services/GitContextAnalyzer';
import { GitContextTreeProvider } from './providers/GitContextTreeProvider';
import { registerCommands } from './commands/OllamaCommands';
import { registerGiteaCommands } from './commands/GiteaCommands';

let ollamaService: OllamaService;
let codeAnalyzer: CodeAnalyzer;
let giteaService: GiteaService;
let gitContextAnalyzer: GitContextAnalyzer;
let gitContextProvider: GitContextTreeProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Activando extensión de análisis de código con Ollama y Gitea...');
    
	const openGiteaSettings = vscode.commands.registerCommand('ollamaCodeAnalyzer.openGiteaSettings', async () => {
  await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:tu-publicador.ollama-code-analyzer gitea');
});

    // Inicializar servicios
    ollamaService = new OllamaService();
    codeAnalyzer = new CodeAnalyzer(ollamaService);
    giteaService = new GiteaService();
    gitContextAnalyzer = new GitContextAnalyzer(giteaService, ollamaService);
    
    // Inicializar provider del árbol de contexto Git
    gitContextProvider = new GitContextTreeProvider(giteaService);
    
	
    // Registrar el tree view para el contexto Git
    const gitContextView = vscode.window.createTreeView('giteaContext', {
        treeDataProvider: gitContextProvider,
        showCollapseAll: true
    });
    
    // Registrar comandos
    registerCommands(context, ollamaService, codeAnalyzer);
    registerGiteaCommands(context, giteaService, gitContextAnalyzer, gitContextProvider);
    
    // Función de debounce mejorada
    function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
        let timeoutId: NodeJS.Timeout | undefined;
        return function(this: any, ...args: Parameters<T>) {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        } as T;
    }
    
    // Análisis debounced con contexto Git
    const debouncedAnalysisWithGit = debounce(async (document: vscode.TextDocument) => {
        const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
        const useGitContext = config.get<boolean>('gitea.useContextualAnalysis', true);
        
        if (useGitContext && await giteaService.isConfigured()) {
            // Análisis con contexto Git
            await gitContextAnalyzer.analyzeFileWithGitContext(document);
            
            // Actualizar el tree view con el archivo actual
            const relativePath = getRelativeFilePath(document.uri);
            if (relativePath) {
                gitContextProvider.refresh(relativePath);
            }
        } else {
            // Análisis tradicional sin contexto Git
            await codeAnalyzer.analyzeDocument(document);
        }
    }, 800);
    
    // Listener para cambios en el documento
    const documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
        const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
        const autoAnalyze = config.get<boolean>('autoAnalyze', true);
        const supportedLanguages = config.get<string[]>('supportedLanguages', ['csharp', 'javascript', 'typescript', 'python']);
        
        if (autoAnalyze && supportedLanguages.includes(event.document.languageId)) {
            debouncedAnalysisWithGit(event.document);
        }
    });
    
    // Listener para cuando se cambia el editor activo
    const activeEditorChangeListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            const relativePath = getRelativeFilePath(editor.document.uri);
            if (relativePath) {
                gitContextProvider.refresh(relativePath);
            }
        }
    });
    
    // Listener para cuando se abre un documento
    const documentOpenListener = vscode.workspace.onDidOpenTextDocument(document => {
        const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
        const analyzeOnOpen = config.get<boolean>('analyzeOnOpen', false);
        const supportedLanguages = config.get<string[]>('supportedLanguages', ['csharp', 'javascript', 'typescript', 'python']);
        
        if (analyzeOnOpen && supportedLanguages.includes(document.languageId)) {
            debouncedAnalysisWithGit(document);
        }
    });
    
    // Status bar item para mostrar estado de Gitea
    const giteaStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    giteaStatusBarItem.command = 'ollamaCodeAnalyzer.checkGiteaStatus';
    updateGiteaStatusBar();
    
    async function updateGiteaStatusBar() {
        const isConfigured = await giteaService.isConfigured();
        if (isConfigured) {
            giteaStatusBarItem.text = '$(git-branch) Gitea Connected';
            giteaStatusBarItem.tooltip = 'Gitea está configurado y conectado';
            giteaStatusBarItem.backgroundColor = undefined;
        } else {
            giteaStatusBarItem.text = '$(warning) Gitea Not Configured';
            giteaStatusBarItem.tooltip = 'Click para configurar Gitea';
            giteaStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        giteaStatusBarItem.show();
    }
    
    // Agregar listeners al contexto para cleanup
    context.subscriptions.push(
        documentChangeListener,
        activeEditorChangeListener,
        documentOpenListener,
        gitContextView,
        giteaStatusBarItem
    );
    
    // Verificar disponibilidad de servicios
    checkServicesAvailability();
}

function getRelativeFilePath(uri: vscode.Uri): string | null {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        return null;
    }
    
    const path = require('path');
    return path.relative(workspaceFolder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
}

async function checkServicesAvailability() {
    // Verificar Ollama
    const ollamaAvailable = await ollamaService.isAvailable();
    const giteaConfigured = await giteaService.isConfigured();
    
    if (!ollamaAvailable) {
        vscode.window.showWarningMessage(
            'Ollama no está disponible. Asegúrese de que esté instalado y ejecutándose.',
            'Configurar Ollama', 'Reintentar'
        ).then(selection => {
            if (selection === 'Reintentar') {
                checkServicesAvailability();
            } else if (selection === 'Configurar Ollama') {
                vscode.env.openExternal(vscode.Uri.parse('https://ollama.ai/'));
            }
        });
    }
    
    if (!giteaConfigured) {
        const action = await vscode.window.showInformationMessage(
            'Gitea no está configurado. ¿Deseas configurarlo para obtener análisis contextual?',
            'Configurar Gitea', 'Más tarde'
        );
        
        if (action === 'Configurar Gitea') {
            vscode.commands.executeCommand('ollamaCodeAnalyzer.configureGitea');
        }
    }
    
    if (ollamaAvailable && giteaConfigured) {
        const models = await ollamaService.getModels();
        vscode.window.showInformationMessage(
            `✅ Ollama y Gitea están listos! Modelos disponibles: ${models.length}`
        );
    }
}

export function deactivate() {
    console.log('Desactivando extensión de análisis de código...');
}