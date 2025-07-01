import * as vscode from 'vscode';
import { OllamaService } from './services/OllamaService';
import { CodeAnalyzer } from './services/CodeAnalyzer';
import { GiteaService } from './services/GiteaService';
import { GitContextAnalyzer } from './services/GitContextAnalyzer';
import { GitContextTreeProvider } from './providers/GitContextTreeProvider';
import { registerOllamaCommands } from './commands/OllamaCommands';
import { registerGiteaCommands } from './commands/GiteaCommands';
import { registerEventListeners } from './events/listeners';
import { updateGiteaStatusBar } from './ui/statusBar';
import { checkServicesAvailability } from './utils/startupChecks';
import { RefactorProvider } from './providers/RefactorProvider';

/**
 * Contenedor de servicios para pasarlos fácilmente a otros módulos.
 */
export interface ExtensionServices {
    ollamaService: OllamaService;
    codeAnalyzer: CodeAnalyzer;
    giteaService: GiteaService;
    gitContextAnalyzer: GitContextAnalyzer;
    gitContextProvider: GitContextTreeProvider;
}

/**
 * Función principal que se ejecuta cuando la extensión es activada.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Activando extensión "Ollama Code Analyzer"...');

    const ollamaService = new OllamaService();
    const codeAnalyzer = new CodeAnalyzer(ollamaService);
    const giteaService = new GiteaService();
    const gitContextAnalyzer = new GitContextAnalyzer(giteaService, ollamaService);
    const gitContextProvider = new GitContextTreeProvider(giteaService);

    const services: ExtensionServices = {
        ollamaService,
        codeAnalyzer,
        giteaService,
        gitContextAnalyzer,
        gitContextProvider
    };

    const gitContextView = vscode.window.createTreeView('giteaContext', {
        treeDataProvider: gitContextProvider,
        showCollapseAll: true
    });

    const giteaStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

    registerOllamaCommands(context, services);
    registerGiteaCommands(context, services, giteaStatusBarItem);
    registerEventListeners(context, services, giteaStatusBarItem);

    const refactorDiagnosticCollection = vscode.languages.createDiagnosticCollection('ollama-refactor');
    const refactorProvider = new RefactorProvider(services, refactorDiagnosticCollection);

    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        ['javascript', 'typescript', 'python', 'java', 'csharp'],
        refactorProvider,
        RefactorProvider.metadata
    );

    const findSuggestionsCommand = vscode.commands.registerCommand('ollamaCodeAnalyzer.findSuggestions', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Buscando sugerencias de código con Ollama...',
                cancellable: false
            }, () => refactorProvider.updateDiagnostics(editor.document));
        }
    });

    const onDidSaveListener = vscode.workspace.onDidSaveTextDocument(document => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === document) {
            refactorProvider.updateDiagnostics(document);
        }
    });

    context.subscriptions.push(
        gitContextView,
        giteaStatusBarItem,
        refactorDiagnosticCollection,
        codeActionProvider,
        findSuggestionsCommand,
        onDidSaveListener
    );

    checkServicesAvailability(ollamaService, giteaService, giteaStatusBarItem);

    console.log('Extensión "Ollama Code Analyzer" activada y lista.');
}

export function deactivate() {
    console.log('Desactivando extensión...');
}
