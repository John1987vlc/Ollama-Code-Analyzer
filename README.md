# Ollama Code Analyzer 🚀

Run **AI-powered code analysis** directly inside **Visual Studio Code** — fully **local**, **private**, and lightning fast.

[![Download](https://img.shields.io/badge/Download-.VSIX-blue)](#-installation)  
[![License: CC0](https://img.shields.io/badge/License-CC0-green)](LICENSE)

---

## ✨ Why Use It?

- 🐞 **Find Bugs Fast** — Detect issues, bad practices, and inconsistencies.  
- ⚡ **Generate Code from Comments** — Write `///` or `#` and let AI create the code.  
- 🔄 **Pro Refactoring** — AI understands your intent, not just syntax.  
- 📚 **Explain Complex Code** — Select code, get instant clarity.  
- 🧪 **Auto Unit Tests** — Generate tests in seconds.  
- 🗺 **UML Diagrams** — Full project structure, visualized in PlantUML.  
- 🛡 **Private by Design** — Runs entirely on your machine with **Ollama**.

---

## 📦 Quick Setup

1️⃣ **Install Ollama** → [ollama.com](https://ollama.com)  
2️⃣ **Get a Model** → e.g. `codellama`, `mistral`, `gemma:2b`  
3️⃣ **Install Extension**

```bash
npm install
vsce package
code --install-extension ollama-code-analyzer-*.vsix
```

---

## 💻 Example Commands

- **Smart Refactor** → Improve code quality.  
- **Explain Code** → Clear, concise breakdown.  
- **Generate Unit Test** → Instant test creation.  
- **Analyze File/Project** → Complete health check.  
- **Generate UML** → Visualize relationships.

---

## ⚙️ Config in VS Code

| Setting | Default | Description |
|---------|---------|-------------|
| `ollamaCodeAnalyzer.baseUrl` | `http://localhost:11434` | Ollama API endpoint |
| `ollamaCodeAnalyzer.model` | `codellama:7b` | AI model to use |
| `ollamaCodeAnalyzer.outputLanguage` | `English` | AI response language |

---

## 📜 License

**CC0 1.0 Universal** — free to use, modify, and share.
