// media/main.js
(function() {
    const vscode = acquireVsCodeApi();

    document.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', event => {
            const buttonEl = event.currentTarget;
            if (buttonEl) {
                // Navegamos al <pre><code> para obtener el código
                const codeContainer = buttonEl.closest('.code-container');
                const codeEl = codeContainer.querySelector('pre > code');
                if(codeEl){
                    const code = codeEl.textContent || '';
                     vscode.postMessage({
                        command: 'copyCode',
                        text: code
                    });
                }
            }
        });
    });
}());