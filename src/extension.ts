// src/extension.ts
import * as vscode from 'vscode';
import { CoreExtensionContext } from './context/ExtensionContext';
import { registerAllCommands } from './commands/index';
import { registerEventListeners } from './events/listeners';
import { checkServicesAvailability } from './utils/startupChecks';
import { updateGiteaStatusBar } from './ui/statusBar';
import {RefactorProvider} from './providers/RefactorProvider';

let coreContext: CoreExtensionContext;

export function activate(context: vscode.ExtensionContext) {
    console.log('Activando extensión "Ollama Code Analyzer"...');

    // 1. Inicializar el contexto central
    coreContext = new CoreExtensionContext(context);

    // 2. Registrar componentes de la UI
    const giteaStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    const gitContextView = vscode.window.createTreeView('giteaContext', {
        treeDataProvider: coreContext.gitContextProvider,
        showCollapseAll: true
    });

    // 3. Registrar todos los comandos, proveedores y listeners
    registerAllCommands(coreContext, context,giteaStatusBarItem);
    registerEventListeners(context,coreContext, giteaStatusBarItem);
    
    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        ['javascript', 'typescript', 'python', 'java', 'csharp'],
        coreContext.refactorProvider,
        { providedCodeActionKinds: RefactorProvider.metadata.providedCodeActionKinds }
    );

    // 4. Añadir elementos al array de suscripciones para que VS Code los gestione
    context.subscriptions.push(
        coreContext,
        giteaStatusBarItem,
        gitContextView,
        codeActionProvider
    );

    // 5. Realizar comprobaciones de inicio
    checkServicesAvailability(coreContext.ollamaService, coreContext.giteaService, giteaStatusBarItem)
        .then(() => updateGiteaStatusBar(coreContext.giteaService, giteaStatusBarItem));

    console.log('Extensión "Ollama Code Analyzer" activada y lista.');
}

export function deactivate() {
    console.log('Desactivando extensión...');
}