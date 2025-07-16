# Ollama Code Analyzer

Una extensión para Visual Studio Code que potencia tu flujo de desarrollo integrando análisis de código avanzado mediante modelos de IA locales a través de Ollama.

## ✨ Características Principales

Esta extensión trae el poder de los Grandes Modelos de Lenguaje (LLM) directamente a tu editor, ejecutándose de forma local para garantizar la privacidad y la velocidad.

### Análisis de Código Inteligente
Detecta bugs, inconsistencias, malas prácticas y problemas de mantenibilidad en tu código.

### Generación de Código Asistida
Crea fragmentos de código a partir de instrucciones simples escritas como comentarios (`///`, `#`, `/*...*/`, etc.).

### Refactorización Conceptual Inteligente
No se limita a sugerencias simples. Infiere la intención original de tu código y propone refactorizaciones a nivel profesional, explicando el porqué de la mejora.

### Explicación de Código
¿No entiendes un bloque de código complejo? Selecciónalo y solicita una explicación clara y concisa sobre su funcionamiento.

### Generación de Pruebas Unitarias
Acelera tu ciclo de TDD generando pruebas unitarias para el código seleccionado, utilizando frameworks populares del lenguaje correspondiente.

### Generación de Diagramas UML
Analiza la estructura de todo tu proyecto (clases, interfaces, relaciones) y genera automáticamente un diagrama de clases en formato PlantUML.

### Validación de Estándares
Comprueba si un fichero o todo el proyecto cumple con las mejores prácticas y los estándares de codificación del lenguaje.

### Totalmente Local y Privado
Todo el análisis se ejecuta en tu máquina a través de tu instancia local de Ollama. Tu código nunca abandona tu entorno.

---

## 🚀 Requisitos

Antes de instalar, asegúrate de tener:

- Visual Studio Code (versión 1.74.0 o superior).
- Ollama instalado y en ejecución en tu sistema. Descárgalo desde [ollama.com](https://ollama.com).
- Un modelo de lenguaje orientado a código descargado en Ollama (ej: `codellama`, `gemma:2b`, `mistral`).

---

## 📦 Instalación

1. Clona el repositorio o descarga los archivos.
2. Abre una terminal en la raíz del proyecto y empaqueta la extensión:

```bash
npm install
vsce package
```

3. Instala el archivo `.vsix` generado usando la línea de comandos de VS Code:

```bash
code --install-extension ollama-code-analyzer-*.vsix
```

4. Reinicia VS Code y la extensión estará lista para usarse.

---

## ⚙️ Configuración

Puedes personalizar la extensión a través de los ajustes de VS Code (`Archivo > Preferencias > Ajustes`), buscando **Ollama Code Analyzer**.

- `ollamaCodeAnalyzer.baseUrl`: URL de tu servicio de Ollama (por defecto: `http://localhost:11434`).
- `ollamaCodeAnalyzer.outputLanguage`: Idioma para las respuestas de la IA (comentarios, explicaciones, etc.). Opciones: `Español`, `English`.

También puedes configurar el modelo a usar directamente desde la paleta de comandos.

---

## 💻 Uso y Comandos

### Menú Contextual (Clic Derecho en el Editor)

Aparecerá un submenú llamado **"Gemma3n Analysis"** con los comandos agrupados por contexto:

#### 1. Comandos de Selección (cuando tienes código seleccionado)
- **Proponer refactorización inteligente**: Ofrece una reescritura del código seleccionado para mejorarlo.
- **Explicar código seleccionado**: Abre una vista con una explicación detallada de lo que hace el código.
- **Generar prueba unitaria**: Crea un test para la lógica del código seleccionado.

#### 2. Comandos de Archivo
- **Analizar Documento Actual**: Realiza un análisis completo del archivo activo.
- **Validar estándares de empresa**: Comprueba si el código sigue buenas prácticas.
- **Detectar lógica duplicada**: Busca bloques repetidos o muy similares.
- **Buscar sugerencias de refactorización**: Lista posibles mejoras.
- **Generar código desde comentario**: Convierte un comentario instructivo en código funcional.

#### 3. Comandos de Proyecto
- **Generar Diagrama UML del proyecto**: Analiza todos los archivos del workspace y genera un diagrama de clases.
- **Validar estándares del proyecto**: Ejecuta el validador de estándares en todos los archivos y genera un informe consolidado.

### Paleta de Comandos (`Ctrl+Shift+P`)

Todos los comandos anteriores están disponibles en la paleta de comandos. Ejemplo: `"Analizar Documento Actual"`.

Comandos de configuración adicionales:
- **Configurar Modelo**: Elegir el modelo de Ollama para análisis y generación.
- **Configurar Idioma de Salida**: Cambia entre `Español` e `English` para las respuestas de la IA.

---

## 📜 Licencia

Este proyecto está bajo la licencia **CC0 1.0 Universal**. Eres libre de usar, modificar y distribuir el código como desees.
