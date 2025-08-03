import * as vscode from 'vscode';
import { CoreExtensionContext } from './context/ExtensionContext';
import { registerAllCommands } from './commands';
import { registerEventListeners } from './events/listeners';
import { checkServicesAvailability } from './utils/startupChecks';
import { RefactorProvider } from './providers/RefactorProvider';
import { I18n } from './internationalization/i18n';
import { Logger } from './utils/logger'; 

export let coreContext: CoreExtensionContext;

export async function activate(context: vscode.ExtensionContext) {
    // --- 2. Inicializar el Logger ---
    Logger.initialize('Ollama Code Analyzer');
    Logger.log('Activating extensíon "Ollama Code Analyzer"...');

    try {
        I18n.initialize(context); 

        coreContext = new CoreExtensionContext(context);

        registerAllCommands(coreContext, context);
        registerEventListeners(context, coreContext);
        
        const codeActionProvider = vscode.languages.registerCodeActionsProvider(
            ['javascript', 'typescript', 'python', 'java', 'csharp'],
            coreContext.refactorProvider,
            { providedCodeActionKinds: RefactorProvider.metadata.providedCodeActionKinds }
        );

        context.subscriptions.push(
            coreContext,
            codeActionProvider
        );

        await checkServicesAvailability(coreContext.ollamaService);

        Logger.log('Extensión "Ollama Code Analyzer" running.');

    } catch (error) {
        // --- 3. Capturar cualquier error durante la activación ---
        Logger.error('Error activating extension.', error);
        Logger.show(); // Muestra el panel de logs automáticamente si hay un error
        vscode.window.showErrorMessage('Error activating extension. Check logs for more detail');
    }
}