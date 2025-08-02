// media/main.js
(function() {
    const vscode = acquireVsCodeApi();
    
// Función para copiar el texto del bloque de pensamiento
    function copyThinking() {
        const thinkingText = document.querySelector('.thinking-code code').textContent;
        navigator.clipboard.writeText(thinkingText).then(() => {
            const btn = document.querySelector('.copy-btn');
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.5 3L6 10.5l-3.5-3.5L1 8.5l5 5L15 4.5z"/>
                    </svg>
                    ¡Copiado!
                `;
                btn.style.color = '#4ECDCC';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.color = '';
                }, 2000);
            }
        }).catch((err) => {
            console.error('Error al copiar el texto: ', err);
        });
    }
    
    // Función para configurar la animación SVG personalizada
    function setupGemmaAnimation() {
        const lottieContainer = document.getElementById('gemma-lottie-animation');
        if (lottieContainer) {
            lottieContainer.innerHTML = `
                <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="gemmaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#4ECDCC;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#FF6B6B;stop-opacity:1" />
                        </linearGradient>
                        <filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                    </defs>
                    <circle cx="60" cy="60" r="45" fill="none" stroke="url(#gemmaGradient)" stroke-width="2" stroke-dasharray="10,5" opacity="0.6" filter="url(#glow)">
                        <animateTransform attributeName="transform" type="XML" from="0 60 60" to="360 60 60" dur="4s" repeatCount="indefinite"/>
                    </circle>
                    <circle cx="60" cy="60" r="35" fill="none" stroke="url(#gemmaGradient)" stroke-width="1.5" stroke-dasharray="8,3" opacity="0.8">
                        <animateTransform attributeName="transform" type="XML" from="360 60 60" to="0 60 60" dur="3s" repeatCount="indefinite"/>
                    </circle>
                    <g transform="translate(60,60)">
                        <circle cx="0" cy="0" r="15" fill="url(#gemmaGradient)" opacity="0.9" filter="url(#glow)">
                            <animate attributeName="r" values="15;18;15" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;1;0.9" dur="2s" repeatCount="indefinite"/>
                        </circle>
                        <g>
                            <polygon points="-8,-8 8,-8 12,-4 8,8 -8,8 -12,-4" fill="url(#gemmaGradient)" opacity="0.7" filter="url(#glow)">
                                <animateTransform attributeName="transform" type="XML" from="0 0 0" to="360 0 0" dur="6s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0.9;0.7" dur="2s" repeatCount="indefinite"/>
                            </polygon>
                        </g>
                        <circle cx="20" cy="-10" r="2" fill="#4ECDCC" opacity="0.8"><animate attributeName="cy" values="-10;-15;-10" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite"/></circle>
                        <circle cx="-18" cy="12" r="1.5" fill="#FF6B6B" opacity="0.8"><animate attributeName="cy" values="12;17;12" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;1;0.8" dur="1.8s" repeatCount="indefinite"/></circle>
                        <circle cx="15" cy="18" r="1" fill="#4ECDCC" opacity="0.6"><animate attributeName="cy" values="18;23;18" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;1;0.6" dur="2.2s" repeatCount="indefinite"/></circle>
                    </g>
                </svg>`;
        }
    }

    // Esperamos a que el DOM esté completamente cargado para ejecutar el código
    window.addEventListener('load', () => {
        setupGemmaAnimation();

        // Asignamos el evento al botón de copiar solo si existe
        const copyButton = document.querySelector('.copy-btn');
        if (copyButton) {
            copyButton.addEventListener('click', copyThinking);
        }
    });

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