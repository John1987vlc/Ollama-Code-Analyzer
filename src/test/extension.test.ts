// src/test/extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { CoreExtensionContext } from '../context/ExtensionContext';
import { coreContext, activate } from '../extension';

// Suite de pruebas para la extensión Ollama Code Analyzer
suite('Ollama Code Analyzer Extension Test Suite', () => {
    let extension: vscode.Extension<any>;
    let coreCtx: CoreExtensionContext;

    // --- HOOK: Se ejecuta una vez antes de todas las pruebas ---
    suiteSetup(async function() {
        this.timeout(10000); // Aumentar el timeout a 10 segundos
        // Espera a que la extensión se active
                extension = vscode.extensions.getExtension('ollama-code-analyzer.ollama-code-analyzer')!;
        const activatedExtension = await extension.activate();
        coreCtx = activatedExtension.coreContext; // Access the returned coreContext

        // Assign coreCtx after activation
        coreCtx = coreContext; // Use the directly imported coreContext
        
        // Directly mock the methods of the existing promptingService instance
        coreCtx.promptingService.getAnalysisPrompt = async (code, lang) => 'Mock analysis prompt';
        coreCtx.promptingService.getConceptualRefactorPrompt = async (code, lang) => 'Mock conceptual refactor prompt';
        coreCtx.promptingService.getGenerationPrompt = async (instr, lang) => 'Mock generation prompt';
        coreCtx.promptingService.getExplainPrompt = async (code, lang) => 'Mock explain prompt';
        coreCtx.promptingService.getUnitTestPrompt = async (code, lang) => 'Mock unit test prompt';
        coreCtx.promptingService.getStandardsPrompt = async (code, lang) => 'Mock standards prompt';
        coreCtx.promptingService.getDuplicateDetectionPrompt = async (code, lang) => 'Mock duplicate detection prompt';
        coreCtx.promptingService.getRefactorPrompt = async (code, lang) => 'Mock refactor prompt';
        coreCtx.promptingService.getUmlExtractPrompt = async (file, lang) => 'Mock UML extract prompt';
        coreCtx.promptingService.getUmlSynthesizePrompt = async (structure) => 'Mock UML synthesize prompt';
    });

    // --- TEST 1: The extension activates correctly ---
    test('Should activate the extension', () => {
        assert.ok(extension, 'Extension not found.');
        assert.strictEqual(extension.isActive, true, 'Extension did not activate correctly.');
    });

    // --- TEST 2: The "analyzeCurrentDocument" command is registered and executed ---
    test('Should execute analyzeCurrentDocument command', async () => {
        // Create a test document
        const document = await vscode.workspace.openTextDocument({
            language: 'javascript',
            content: 'var x = 1; // Uses var, which is bad practice'
        });
        await vscode.window.showTextDocument(document);

        // Execute the command
        try {
            await vscode.commands.executeCommand('ollamaCodeAnalyzer.analyzeCurrentDocument');
            // The test passes if the command does not throw an exception.
            // UI verification (webview) is more complex and omitted here.
            assert.ok(true);
        } catch (error) {
            assert.fail(`analyzeCurrentDocument command failed: ${error}`);
        }
    });

    // --- TEST 3: The "generateCodeFromComment" command is executed ---
    test('Should execute generateCodeFromComment command', async () => {
        const document = await vscode.workspace.openTextDocument({
            language: 'python',
            content: '# Create a function that sums two numbers'
        });
        await vscode.window.showTextDocument(document);
        
        // Move cursor to the comment line
        const editor = vscode.window.activeTextEditor!;
        const position = new vscode.Position(0, 0);
        editor.selection = new vscode.Selection(position, position);

        try {
            await vscode.commands.executeCommand('ollamaCodeAnalyzer.generateCodeFromComment');
            assert.ok(true, "generateCodeFromComment command executed without errors.");
        } catch (error) {
            assert.fail(`generateCodeFromComment command failed: ${error}`);
        }
    });

    // --- TEST 4: The "explainCode" command is executed ---
    test('Should execute explainCode command on a selection', async () => {
        const document = await vscode.workspace.openTextDocument({
            language: 'typescript',
            content: 'const add = (a: number, b: number): number => a + b;'
        });
        const editor = await vscode.window.showTextDocument(document);
        
        // Select the text
        editor.selection = new vscode.Selection(
            new vscode.Position(0, 0),
            new vscode.Position(0, 50) // Select the entire line
        );

        try {
            await vscode.commands.executeCommand('ollamaCodeAnalyzer.explainCode');
            assert.ok(true, "explainCode command executed without errors.");
        } catch (error) {
            assert.fail(`explainCode command failed: ${error}`);
        }
    });
    
    // --- TEST 5: The "generateUnitTest" command is executed ---
    test('Should execute generateUnitTest command on a selection', async () => {
        const document = await vscode.workspace.openTextDocument({
            language: 'javascript',
            content: 'function subtract(a, b) { return a - b; }'
        });
        const editor = await vscode.window.showTextDocument(document);
        
        // Select the text
        editor.selection = new vscode.Selection(
            new vscode.Position(0, 0),
            new vscode.Position(0, 40)
        );

        try {
            await vscode.commands.executeCommand('ollamaCodeAnalyzer.generateUnitTest');
            assert.ok(true, "generateUnitTest command executed without errors.");
        } catch (error) {
            assert.fail(`generateUnitTest command failed: ${error}`);
        }
    });

    // --- TEST 6: The model configuration command opens ---
    // Note: This only verifies that the command exists. QuickPick interaction cannot be tested here.
    test('Should register configureModel command', async () => {
        const commands = await vscode.commands.getCommands();
        assert.ok(
            commands.includes('ollamaCodeAnalyzer.configureModel'),
            'The ollamaCodeAnalyzer.configureModel command is not registered.'
        );
    });

    // --- TEST 7: The generate UML diagram command is executed ---
    test('Should execute generateUmlDiagram command', async function() {
        // This test may take time, increase timeout
        this.timeout(20000);

        // Ensure a workspace is open
        if (!vscode.workspace.workspaceFolders) {
            this.skip(); // Cannot execute without a workspace
            return;
        }

        try {
            await vscode.commands.executeCommand('ollamaCodeAnalyzer.generateUmlDiagram');
            assert.ok(true, "generateUmlDiagram command executed without errors.");
        } catch (error) {
            assert.fail(`generateUmlDiagram command failed: ${error}`);
        }
    });

    // --- Cleanup after tests ---
    suiteTeardown(async () => {
        // Close all open editors to avoid interfering with other tests
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });
});