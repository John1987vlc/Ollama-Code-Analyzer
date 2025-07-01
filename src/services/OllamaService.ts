import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  top_p?: number; // Agregado para el CodeAnalyzer
}

interface GenerateResponse {
  response: string;
  responseTokens: number;
  promptTokens: number;
}

interface OllamaModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: {
    family: string;
    families: string[] | null;
    format: string;
    parameter_size: string;
    quantization_level: string;
  };
  expires_at: string;
  size_vb: number;
}

interface ConceptualRefactoringResult {
  intent: string;
  explanation: string;
  suggestion: string;
}

export class OllamaService {
  private readonly baseUrl = 'http://127.0.0.1:11434';
  private readonly timeoutMs = 30000;

  constructor() {}

  private async loadTemplate(templateName: string): Promise<string> {
    const filePath = path.resolve(__dirname, templateName);
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      vscode.window.showErrorMessage(`Error al cargar plantilla ${templateName}: ${(error as Error).message}`);
      throw error;
    }
  }

  private extractJsonArray(text: string): any[] | null {
    // Busca un JSON array delimitado con ---json--- y ---end---
    const match = text.match(/---json---\s*(\[[\s\S]*?\])\s*---end---/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }

  private extractJsonObject(text: string): any | null {
    // Busca un JSON object delimitado con ---json--- y ---end---
    const match = text.match(/---json---\s*(\{[\s\S]*?\})\s*---end---/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }

  /**
   * Verifica si Ollama está disponible
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // Timeout más corto para verificación
      });
      return response.ok;
    } catch (error) {
      console.error('Ollama no está disponible:', error);
      return false;
    }
  }

  /**
   * Obtiene la lista de modelos disponibles en Ollama
   */
  public async getModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Error obteniendo modelos: ${response.statusText}`);
      }

      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Error obteniendo modelos de Ollama:', error);
      vscode.window.showErrorMessage(`Error obteniendo modelos: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Genera código a partir de una instrucción
   */
  public async generateCode(instruction: string, language: string, model: string): Promise<string | null> {
    try {
      const prompt = `Generate ${language} code for the following instruction. Return ONLY the code, no explanations or markdown:

Instruction: ${instruction}

Code:`;

      const response = await this.generate(prompt, model, {
        temperature: 0.2,
        stream: false
      });

      if (!response?.response) {
        return null;
      }

      // Limpiar la respuesta de posibles markdown o explicaciones
      let code = response.response.trim();
      code = code.replace(/^```[\w]*\n|```$/gm, '').trim();
      
      return code;
    } catch (error) {
      console.error('Error generando código:', error);
      vscode.window.showErrorMessage(`Error generando código: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Realiza refactorización conceptual del código
   */
  public async getConceptualRefactoring(
    code: string,
    language: string,
    model: string
  ): Promise<ConceptualRefactoringResult | null> {
    try {
      const prompt = `Analyze this ${language} code and suggest a conceptual refactoring. 

Code:
\`\`\`${language}
${code}
\`\`\`

Respond with a JSON object containing:
- intent: Brief description of what you think the user wants to achieve
- explanation: Detailed explanation of the suggested refactoring
- suggestion: The refactored code

Format your response as:
---json---
{
  "intent": "your intent description",
  "explanation": "your explanation",
  "suggestion": "refactored code here"
}
---end---`;

      const response = await this.generate(prompt, model, {
        temperature: 0.3,
        stream: false
      });

      if (!response?.response) {
        return null;
      }

      const result = this.extractJsonObject(response.response);
      if (result && result.intent && result.explanation && result.suggestion) {
        return result as ConceptualRefactoringResult;
      }

      return null;
    } catch (error) {
      console.error('Error en refactorización conceptual:', error);
      vscode.window.showErrorMessage(`Error en refactorización: ${(error as Error).message}`);
      return null;
    }
  }

  public async getRefactoringSuggestions(
    code: string,
    language: string,
    model: string
  ): Promise<any[] | null> {
    try {
      const promptTemplate = await this.loadTemplate('../prompts/refactorPrompt.txt');
      const prompt = promptTemplate.replace('{{code}}', code).replace('{{language}}', language);

      const response = await this.generate(prompt, model, { temperature: 0.3, stream: false });
      if (!response?.response) return null;

      const suggestions = this.extractJsonArray(response.response);
      return suggestions || null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        vscode.window.showErrorMessage('Tiempo de espera agotado al obtener sugerencias de refactorización.');
      } else {
        vscode.window.showErrorMessage(`Error obteniendo sugerencias de refactorización: ${(error as Error).message}`);
      }
      return null;
    }
  }

  public async getReviewSuggestions(
    code: string,
    language: string,
    model: string
  ): Promise<any[] | null> {
    try {
      const promptTemplate = await this.loadTemplate('../prompts/reviewPrompt.txt');
      const prompt = promptTemplate.replace('{{code}}', code).replace('{{language}}', language);

      const response = await this.generate(prompt, model, { temperature: 0.3, stream: false });
      if (!response?.response) return null;

      const suggestions = this.extractJsonArray(response.response);
      return suggestions || null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        vscode.window.showErrorMessage('Tiempo de espera agotado al obtener sugerencias de revisión.');
      } else {
        vscode.window.showErrorMessage(`Error obteniendo sugerencias de revisión: ${(error as Error).message}`);
      }
      return null;
    }
  }

  public async getTestSuggestions(
    code: string,
    language: string,
    model: string
  ): Promise<any[] | null> {
    try {
      const promptTemplate = await this.loadTemplate('../prompts/testPrompt.txt');
      const prompt = promptTemplate.replace('{{code}}', code).replace('{{language}}', language);

      const response = await this.generate(prompt, model, { temperature: 0.3, stream: false });
      if (!response?.response) return null;

      const suggestions = this.extractJsonArray(response.response);
      return suggestions || null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        vscode.window.showErrorMessage('Tiempo de espera agotado al obtener sugerencias de pruebas.');
      } else {
        vscode.window.showErrorMessage(`Error obteniendo sugerencias de pruebas: ${(error as Error).message}`);
      }
      return null;
    }
  }

  public async generate(
    prompt: string,
    model: string,
    options: GenerateOptions = {}
  ): Promise<GenerateResponse | null> {
    const { temperature = 0.5, maxTokens = 1024, stream = false } = options;

    try {
      if (stream) {
        return await this.generateStream(prompt, model, { temperature, maxTokens });
      }

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          model,
          prompt,
          options: {
            temperature,
            num_predict: maxTokens,
            top_p: options.top_p
          },
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error en la petición: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Ollama devuelve la respuesta directamente en el campo 'response'
      return {
        response: data.response || '',
        responseTokens: data.eval_count || 0,
        promptTokens: data.prompt_eval_count || 0,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        vscode.window.showErrorMessage('Tiempo de espera agotado en la generación de texto.');
      } else {
        vscode.window.showErrorMessage(`Error en la generación: ${(error as Error).message}`);
      }
      return null;
    }
  }

  private async generateStream(
    prompt: string,
    model: string,
    options: { temperature: number; maxTokens: number }
  ): Promise<GenerateResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          model,
          prompt,
          options: {
            temperature: options.temperature,
            num_predict: options.maxTokens,
          },
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error en la petición: ${response.statusText}`);
      }

      if (!response.body || !response.body.getReader) {
        throw new Error('La respuesta no contiene un body legible.');
      }

      const reader = response.body.getReader();
      let resultText = '';
      let totalResponseTokens = 0;
      let totalPromptTokens = 0;
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const jsonData = JSON.parse(line);
            if (jsonData.response) {
              resultText += jsonData.response;
            }
            if (jsonData.eval_count) {
              totalResponseTokens = jsonData.eval_count;
            }
            if (jsonData.prompt_eval_count) {
              totalPromptTokens = jsonData.prompt_eval_count;
            }
          } catch (parseError) {
            // Ignorar líneas que no son JSON válido
          }
        }
      }

      return {
        response: resultText,
        responseTokens: totalResponseTokens,
        promptTokens: totalPromptTokens,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        vscode.window.showErrorMessage('Tiempo de espera agotado en la generación por stream.');
      } else {
        vscode.window.showErrorMessage(`Error en la generación por stream: ${(error as Error).message}`);
      }
      return null;
    }
  }
}