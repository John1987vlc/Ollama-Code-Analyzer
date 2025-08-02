// src/test/extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';

// Suite de pruebas para la extensión Ollama Code Analyzer
suite('Ollama Code Analyzer Extension Test Suite', () => {
    let extension: vscode.Extension<any>;
    let coreCtx: CoreExtensionContext;

    // --- HOOK: Se ejecuta una vez antes de todas las pruebas ---
    suiteSetup(async function() {
        this.timeout(10000); // Aumentar el timeout a 10 segundos
        // Espera a que la extensión se active
        extension = vscode.extensions.getExtension('ollama-code-analyzer-Gemma3n-Gitea.ollama-code-analyzer')!;
        await extension.activate();
    });

    // --- TEST 1: La extensión se activa correctamente ---
    test('Should activate the extension', () => {
        assert.ok(extension, 'La extensión no fue encontrada.');
        assert.strictEqual(extension.isActive, true, 'La extensión no se activó correctamente.');
    });

    // --- TEST 2: El comando "analyzeCurrentDocument" se registra y ejecuta ---
    test('Should execute analyzeCurrentDocument command', async () => {
        // Crear un documento de prueba
        const document = await vscode.workspace.openTextDocument({
            language: 'javascript',
            content: 'var x = 1; // Usa var, es una mala práctica'
        });
        await vscode.window.showTextDocument(document);

        // Ejecutar el comando
        try {
            await vscode.commands.executeCommand('ollamaCodeAnalyzer.analyzeCurrentDocument');
            // La prueba pasa si el comando no lanza una excepción.
            // La verificación de la UI (webview) es más compleja y se omite aquí.
            assert.ok(true);
        } catch (error) {
            assert.fail(`El comando analyzeCurrentDocument falló: ${error}`);
        }
    });

    // --- TEST 3: El comando "generateCodeFromComment" se ejecuta ---
    test('Should execute generateCodeFromComment command', async () => {
        const document = await vscode.workspace.openTextDocument({
            language: 'python',
            content: '# Crea una función que sume dos números'
        });
        await vscode.window.showTextDocument(document);
        
        // Mover el cursor a la línea del comentario
        const editor = vscode.window.activeTextEditor!;
        const position = new vscode.Position(0, 0);
        editor.selection = new vscode.Selection(position, position);

        try {
            await vscode.commands.executeCommand('ollamaCodeAnalyzer.generateCodeFromComment');
            assert.ok(true, "El comando generateCodeFromComment se ejecutó sin errores.");
        } catch (error) {
            assert.fail(`El comando generateCodeFromComment falló: ${error}`);
        }
    });

    // --- TEST 4: El comando "explainCode" se ejecuta ---
    test('Should execute explainCode command on a selection', async () => {
        const document = await vscode.workspace.openTextDocument({
            language: 'typescript',
            content: 'const add = (a: number, b: number): number => a + b;'
        });
        const editor = await vscode.window.showTextDocument(document);
        
        // Seleccionar el texto
        editor.selection = new vscode.Selection(
            new vscode.Position(0, 0),
            new vscode.Position(0, 50) // Selecciona toda la línea
        );

        try {
            await vscode.commands.executeCommand('ollamaCodeAnalyzer.explainCode');
            assert.ok(true, "El comando explainCode se ejecutó sin errores.");
        } catch (error) {
            assert.fail(`El comando explainCode falló: ${error}`);
        }
    });
    
    // --- TEST 5: El comando "generateUnitTest" se ejecuta ---
    test('Should execute generateUnitTest command on a selection', async () => {
        const document = await vscode.workspace.openTextDocument({
            language: 'javascript',
            content: 'function subtract(a, b) { return a - b; }'
        });
        const editor = await vscode.window.showTextDocument(document);
        
        // Seleccionar el texto
        editor.selection = new vscode.Selection(
            new vscode.Position(0, 0),
            new vscode.Position(0, 40)
        );

        try {
            await vscode.commands.executeCommand('ollamaCodeAnalyzer.generateUnitTest');
            assert.ok(true, "El comando generateUnitTest se ejecutó sin errores.");
        } catch (error) {
            assert.fail(`El comando generateUnitTest falló: ${error}`);
        }
    });

    // --- TEST 6: El comando de configuración de modelo se abre ---
    // Nota: Esto solo verifica que el comando existe. La interacción con QuickPick no se puede probar aquí.
    test('Should register configureModel command', async () => {
        const commands = await vscode.commands.getCommands();
        assert.ok(
            commands.includes('ollamaCodeAnalyzer.configureModel'),
            'El comando ollamaCodeAnalyzer.configureModel no está registrado.'
        );
    });

    // --- TEST 7: El comando de generar diagrama UML se ejecuta ---
    test('Should execute generateUmlDiagram command', async function() {
        // Esta prueba puede tardar, aumentamos el timeout
        this.timeout(20000);

        // Asegurarse de que hay un workspace abierto
        if (!vscode.workspace.workspaceFolders) {
            this.skip(); // No se puede ejecutar sin un workspace
            return;
        }

        try {
            await vscode.commands.executeCommand('ollamaCodeAnalyzer.generateUmlDiagram');
            assert.ok(true, "El comando generateUmlDiagram se ejecutó sin errores.");
        } catch (error) {
            assert.fail(`El comando generateUmlDiagram falló: ${error}`);
        }
    });

    // --- Limpieza después de las pruebas ---
    suiteTeardown(async () => {
        // Cerrar todos los editores abiertos para no interferir con otras pruebas
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });
});