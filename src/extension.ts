/**
 * @file Fichero principal y punto de entrada de la extensión "Ollama Code Analyzer".
 * Se encarga de la activación y desactivación de la extensión, inicializando
 * todos los servicios, comandos y listeners necesarios para su funcionamiento.
 */
import * as vscode from 'vscode';
import { CoreExtensionContext } from './context/ExtensionContext';
import { registerAllCommands } from './commands';
import { registerEventListeners } from './events/listeners';
import { checkServicesAvailability } from './utils/startupChecks';
import { RefactorProvider } from './providers/RefactorProvider';
import { I18n } from './internationalization/i18n'; // <-- 1. Importar

let coreContext: CoreExtensionContext;

export function activate(context: vscode.ExtensionContext) {
    console.log('Activando extensión "Ollama Code Analyzer"...');

    I18n.initialize(context); 

    // 1. Inicializar el contexto central
    coreContext = new CoreExtensionContext(context);

    // 3. Registrar todos los comandos, proveedores y listeners
    registerAllCommands(coreContext, context);
    registerEventListeners(context,coreContext);
    
    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        ['javascript', 'typescript', 'python', 'java', 'csharp'],
        coreContext.refactorProvider,
        { providedCodeActionKinds: RefactorProvider.metadata.providedCodeActionKinds }
    );

    // 4. Añadir elementos al array de suscripciones para que VS Code los gestione
    context.subscriptions.push(
        coreContext,
        codeActionProvider
    );

    // 5. Realizar comprobaciones de inicio
    checkServicesAvailability(coreContext.ollamaService)

    console.log('Extensión "Ollama Code Analyzer" activada y lista.');
}

export function deactivate() {
    console.log('Desactivando extensión...');
}