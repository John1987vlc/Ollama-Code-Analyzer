// src/media/main.js (NUEVA VERSIÓN CON ESTILO DE SEVERIDAD)
(function() {
    const vscode = acquireVsCodeApi();

    /**
     * Función principal que se ejecuta al cargar el script.
     */
    function initialize() {
        log("Initializing webview script...");
        // 1. Mejora visualmente la lista de issues coloreando la severidad.
        formatDetectedIssues();

        // 2. Añade la funcionalidad a los botones de "Copiar".
        addCopyButtonListeners();
        log("Webview script initialized.");
    }

    /**
     * Busca en el cuerpo del markdown las etiquetas de severidad y les aplica una clase CSS.
     */
    function formatDetectedIssues() {
        log("Formatting detected issues...");
        const markdownBody = document.querySelector('.markdown-body');
        if (!markdownBody) {
            log("Markdown body not found.");
            return;
        }
        log("Markdown body found.");

        // Expresión regular para encontrar "Severity: Error", "Severidad: Warning", etc., sin ser sensible a mayúsculas.
        const severityRegex = /(Severity|Severidad):\s*(Error|Warning|Hint|Information|Info)/gi;

        // Reemplazamos el texto en todo el cuerpo del markdown.
        markdownBody.innerHTML = markdownBody.innerHTML.replace(
            severityRegex,
            (match, p1, p2) => {
                const severityKey = p2.toLowerCase();
                log(`Found severity: ${p2}`);
                return `${p1}: <span class="severity-label severity-${severityKey}">${p2}</span>`;
            }
        );
        log("Detected issues formatted.");
    }


    /**
     * Asigna los listeners de eventos para todos los botones de copiar.
     */
    function addCopyButtonListeners() {
        log("Adding copy button listeners...");
        document.addEventListener('click', event => {
            const button = event.target.closest('.copy-btn');
            if (!button) return;
            log("Copy button clicked.");

            const codeContainer = button.closest('.details-content');
            if (codeContainer) {
                const codeElement = codeContainer.querySelector('pre > code');
                if (codeElement) {
                    vscode.postMessage({
                        command: 'copyCode',
                        text: codeElement.textContent || ''
                    });

                    const originalText = button.textContent;
                    button.textContent = i18n.copied;
                    setTimeout(() => {
                        button.textContent = originalText;
                    }, 2000);
                }
            }
        });
        log("Copy button listeners added.");
    }

    // Ejecutamos el script de inicialización
    initialize();

}());