
# Ollama Code Analyzer

A Visual Studio Code extension that supercharges your development workflow by integrating code analysis powered by local AI models through Ollama, combined with deep contextual insights via Gitea integration.

---

## ✨ Key Features

This extension brings the power of Large Language Models (LLMs) directly into your editor, running locally to ensure privacy and speed.

- **Intelligent Code Analysis**  
  Detect bugs, inconsistencies, bad practices, and maintenance issues in your code.

- **Assisted Code Generation**  
  Create code snippets from simple instructions written as comments.

- **Conceptual Refactoring**  
  Not just suggestions—this infers your code’s original intent and proposes professional-level refactoring.

- **Code Explanation**  
  Don’t understand a complex block of code? Select it and request a clear, concise explanation.

- **Unit Test Generation**  
  Speed up your TDD cycle by generating unit tests for the selected code.

- **Gitea Integration**  
  Enhance AI analysis with your repository context like issues, pull requests, and recent commits related to the file you're editing.

- **Fully Local and Private**  
  All analysis runs on your machine through your local Ollama instance. Your code never leaves your environment.

---

## 🚀 Requirements

Before installing, ensure you have:

- Visual Studio Code (version 1.74.0 or higher)
- Ollama installed and running on your system. Download it from [ollama.com](https://ollama.com).

---

## 📦 Installation

1. Clone the repository or download the files.
2. Open a terminal in the project root and package the extension:

   ```bash
   vsce package
   ```

3. Install the generated `.vsix` file using the VS Code command line:

   ```bash
   code --install-extension ollama-code-analyzer-1.0.0.vsix
   ```

4. Restart VS Code and you're ready to go!

---

## ⚙️ Configuration

Customize the extension through VS Code settings (`File > Preferences > Settings`), search for `ollamaCodeAnalyzer`.

### Ollama Settings

- `ollamaCodeAnalyzer.baseUrl` — URL of your Ollama service (default: `http://localhost:11434`).
- `ollamaCodeAnalyzer.model` — The model to use for analysis (e.g., `codellama:7b`, `gemma:2b`).
- `ollamaCodeAnalyzer.autoAnalyze` — Enable or disable automatic analysis while typing (default: `false`).
- `ollamaCodeAnalyzer.supportedLanguages` — Array of languages for which analysis will be activated.

### Gitea Settings (Optional)

Enable contextual analysis by configuring:

- `ollamaCodeAnalyzer.gitea.baseUrl` — Base URL of your Gitea instance.
- `ollamaCodeAnalyzer.gitea.token` — Your Gitea personal access token.
- `ollamaCodeAnalyzer.gitea.organization` — Your organization or username in Gitea.
- `ollamaCodeAnalyzer.gitea.repository` — Repository name.

---

## 💻 Usage & Commands

You can access features in several ways:

### Command Palette (`Ctrl+Shift+P`)

- **Ollama: Analyze Current Document** — Manually trigger analysis on the active file.
- **Ollama: Clear Diagnostics** — Clear all suggestions from the Problems view.
- **Ollama: Configure Model** — Quickly select the AI model to use.
- **Gitea: Configure Gitea** — Launch a wizard to set up Gitea integration.
- **Gitea: Refresh Context View** — Refresh the sidebar with updated Gitea info.

### Editor Context Menu (Right-Click)

When selecting code, access:

- **Ollama: Propose Intelligent Refactoring** — Get an advanced refactoring suggestion.
- **Ollama: Explain Selected Code** — Receive a detailed explanation of the code’s functionality.
- **Ollama: Generate Unit Test** — Create a test file for the selected code.

### Keyboard Shortcuts

- **Generate Code from Comment (`Ctrl+Shift+J`)**  
  Write an instruction in a line starting with `///`, press the shortcut, and the extension generates code below.

  ```javascript
  /// Make me a function that sums two numbers and multiplies the result by 10
  ```

- **Intelligent Refactoring (`Ctrl+Shift+H`)**  
  Select code and press the shortcut to receive a refactoring proposal.

---

## 📜 License

This project is licensed under the **CC0 1.0 Universal** license. You are free to use, modify, and distribute the code as you wish.
