// src/media/main.js (NUEVA VERSIÓN CON ESTILO DE SEVERIDAD)
(function() {
    const vscode = acquireVsCodeApi();

    /**
     * Función principal que se ejecuta al cargar el script.
     */
    function initialize() {
        // 1. Mejora visualmente la lista de issues coloreando la severidad.
        formatDetectedIssues();

        // 2. Añade la funcionalidad a los botones de "Copiar".
        addCopyButtonListeners();
    }

    /**
     * Busca en el cuerpo del markdown las etiquetas de severidad y les aplica una clase CSS.
     */
    function formatDetectedIssues() {
        const listItems = document.querySelectorAll('.markdown-body ul li');
        if (listItems.length === 0) return;

        const severityRegex = /(Severity:)\s*(Error|Warning|Hint|Information)/gi;

        listItems.forEach(item => {
            // Reemplazamos el texto con HTML que contiene un <span> estilizado
            item.innerHTML = item.innerHTML.replace(
                severityRegex,
                `$1 <span class="severity-label severity-${'$2'.toLowerCase()}">$2</span>`
            );
        });
    }

    /**
     * Asigna los listeners de eventos para todos los botones de copiar.
     */
    function addCopyButtonListeners() {
        document.addEventListener('click', event => {
            const button = event.target.closest('.copy-btn');
            if (!button) return;

            const codeContainer = button.closest('.details-content');
            if (codeContainer) {
                const codeElement = codeContainer.querySelector('pre > code');
                if (codeElement) {
                    vscode.postMessage({
                        command: 'copyCode',
                        text: codeElement.textContent || ''
                    });

                    const originalText = button.textContent;
                    button.textContent = '¡Copiado!';
                    setTimeout(() => {
                        button.textContent = originalText;
                    }, 2000);
                }
            }
        });
    }

    // Ejecutamos el script de inicialización
    initialize();

}());