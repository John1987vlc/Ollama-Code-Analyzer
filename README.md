# Ollama Code Analyzer

Una extensión de VS Code que integra análisis de código con Ollama y Gitea.

## Características

- Analiza código automáticamente con modelos de Ollama
- Muestra issues, pull requests y commits desde Gitea
- Soporte para múltiples lenguajes

## Configuración

Ve a `Archivo > Preferencias > Configuración` y busca `ollamaCodeAnalyzer` para configurar:

- `baseUrl`: URL del servidor Ollama o Gitea
- `token`: Token de acceso personal
- `organization` y `repository`: Opcional para Gitea

## Comandos

- `Configurar Gitea`
- `Actualizar vista de contexto`
- `Abrir configuración de Gitea`

## Instalación

```bash
vsce package
code --install-extension ollama-code-analyzer-1.0.0.vsix
