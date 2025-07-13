// src/services/OllamaService.ts
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PromptingService } from '../services/PromptingService';

// ... (interfaces sin cambios) ...
interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  top_p?: number;
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
  // [CORRECCIÓN] Se ha eliminado el formato Markdown de la URL.
   private get baseUrl() {
      // [MEJORA] Obtener la URL dinámicamente para respetar cambios en la configuración sin reiniciar.
      return vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<string>('baseUrl', 'http://127.0.0.1:11434');
  }
  private get timeoutMs() {
      return vscode.workspace.getConfiguration('ollamaCodeAnalyzer').get<number>('timeout', 45000);
  }
  private promptingService: PromptingService;

  constructor() {
    this.promptingService = new PromptingService();
  }

  private extractJsonArray(text: string): any[] | null {
    const match = text.match(/```json\s*(\[[\s\S]*?\])\s*```/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }

  private extractJsonObject(text: string): any | null {
    const match = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
  
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


  public async generateCode(instruction: string, language: string, model: string): Promise<string | null> {
    try {
      const prompt = await this.promptingService.getGenerationPrompt(instruction, language);
      const response = await this.generate(prompt, model, {
        temperature: 0.2,
        stream: false
      });
      
      if (!response?.response) return null;
      
      let code = response.response.trim();
      return code.replace(/^```[\w]*\n|```$/gm, '').trim();

    } catch (error) {
      console.error('Error generando código:', error);
      vscode.window.showErrorMessage(`Error generando código: ${(error as Error).message}`);
      return null;
    }
  }

  public async getConceptualRefactoring(code: string, language: string, model: string): Promise<ConceptualRefactoringResult | null> {
      try {
          const prompt = await this.promptingService.getConceptualRefactorPrompt(code, language);
          const response = await this.generate(prompt, model, { temperature: 0.3, stream: false });

          if (!response?.response) return null;
          
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

  public async getRefactoringSuggestions(code: string, language: string, model: string): Promise<any[] | null> {
      try {
          const prompt = await this.promptingService.getRefactorPrompt(code, language);
          const response = await this.generate(prompt, model, { temperature: 0.3, stream: false });

          if (!response?.response) return null;

          const suggestions = this.extractJsonArray(response.response);
          return suggestions || null;

      } catch (error) {
          vscode.window.showErrorMessage(`Error obteniendo sugerencias de refactorización: ${(error as Error).message}`);
          return null;
      }
  }
  
  public async getExplanation(code: string, language: string, model: string): Promise<string | null> {
      const prompt = await this.promptingService.getExplainPrompt(code, language);
      const response = await this.generate(prompt, model);
      return response?.response || null;
  }

  public async generateUnitTest(code: string, language: string, model: string): Promise<string | null> {
      const prompt = await this.promptingService.getUnitTestPrompt(code, language);
      const response = await this.generate(prompt, model);
      return response?.response || null;
  }

  public async validateStandards(code: string, language: string, model: string): Promise<string | null> {
      const prompt = await this.promptingService.getStandardsPrompt(code, language);
      const response = await this.generate(prompt, model);
      return response?.response || null;
  }

  public async findDuplicateLogic(code: string, language: string, model: string): Promise<string | null> {
      const prompt = await this.promptingService.getDuplicateDetectionPrompt(code, language);
      const response = await this.generate(prompt, model);
      return response?.response || null;
  }

    public async generateUmlDiagramForFile(file: { path: string, content: string }, contextSummary: string, model: string): Promise<{ uml: string | null, contextSummary: string } | null> {
        try {
            const prompt = await this.promptingService.getUmlGenerationPrompt(file, contextSummary);
            const response = await this.generate(prompt, model, {
                temperature: 0.1,
                stream: false
            });

            if (!response?.response) return null;

            const umlMatch = response.response.match(/@startuml([\s\S]*)@enduml/);
            const uml = umlMatch ? `@startuml${umlMatch[1]}@enduml` : null;
            
            // Suponiendo que el modelo también devuelve un resumen del contexto
            const contextMatch = response.response.match(/<context>([\s\S]*)<\/context>/);
            const newContextSummary = contextMatch ? contextMatch[1].trim() : contextSummary;

            return { uml, contextSummary: newContextSummary };

        } catch (error) {
            console.error('Error generando diagrama UML para el archivo:', error);
            vscode.window.showErrorMessage(`Error generando diagrama UML: ${(error as Error).message}`);
            return null;
        }
    }

public async generate(
      prompt: string, 
      model: string, 
      options: any = {}
  ): Promise<{ response: string; prompt: string; } | null> {
      const { temperature = 0.5, maxTokens = 2048, stream = false } = options;
      console.log(`[OllamaService] Enviando petición a Ollama...`);

      try {
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
          console.log("[OllamaService] Respuesta recibida de Ollama:", data);
          
          return {
              response: data.response || '',
              prompt: prompt // Devolvemos el prompt para mostrarlo en el "thinking"
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
}