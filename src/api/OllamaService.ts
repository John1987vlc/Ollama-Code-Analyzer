/**
 * @file Servicio para interactuar con la API de Ollama.
 * Gestiona todas las comunicaciones con el servidor de Ollama, incluyendo
 * la obtención de modelos, la generación de texto y el streaming de respuestas.
 * También maneja la configuración de la URL base y los tiempos de espera.
 */
// src/services/OllamaService.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { PromptingService } from '../services/PromptingService';
import { Logger } from '../utils/logger'; 

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
    if (!match) {return null;}
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }

  private extractJsonObject(text: string): any | null {
    const match = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (!match) {return null;}
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
      
      if (!response?.response) {return null;}
      
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

          if (!response?.response) {return null;}
          
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

          if (!response?.response) {return null;}

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

    public async extractUmlStructureFromFile(file: { path: string, content: string }, model: string): Promise<any | null> {
    const languageId = vscode.languages.getLanguages().then(langs => {
        // Lógica simple para determinar el lenguaje, se puede mejorar.
        const ext = path.extname(file.path).substring(1);
        return langs.find(l => l.endsWith(ext)) || 'unknown';
    });

    try {
        const prompt = await this.promptingService.getUmlExtractPrompt(file, await languageId);
        const response = await this.generate(prompt, model, { temperature: 0.0 });

        if (!response?.response) {return null;}

        const jsonMatch = response.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return null;
    } catch (error) {
        console.error(`Error extrayendo estructura de ${file.path}:`, error);
        // Devolvemos null para que el proceso continúe con otros archivos.
        return null; 
    }
}

/**
 * Fase 2: Genera el diagrama PlantUML final a partir de la estructura completa del proyecto.
 */
public async synthesizeUmlDiagram(projectStructure: any[], model: string): Promise<string | null> {
    try {
        const prompt = await this.promptingService.getUmlSynthesizePrompt(projectStructure);
        const response = await this.generate(prompt, model, { temperature: 0.1 });

        if (!response?.response) {return null;}

        // Extraer solo el bloque de PlantUML
        const umlMatch = response.response.match(/```plantuml\s*([\s\S]*?)```/);
        return umlMatch ? umlMatch[1] : null;

    } catch (error) {
        console.error('Error sintetizando el diagrama UML:', error);
        vscode.window.showErrorMessage(`Error generando el diagrama final: ${(error as Error).message}`);
        return null;
    }
}

 public async generate(
      prompt: string, 
      model: string, 
      options: any = {}
  ): Promise<{ response: string; prompt: string; } | null> {
      const { temperature = 0.5, maxTokens = 2048, stream = false } = options;
      Logger.log(`Enviando petición a Ollama...`, { baseUrl: this.baseUrl, model });

      try {
          const response = await fetch(`${this.baseUrl}/api/generate`, {
              // ... (resto de la configuración de fetch)
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
              const errorBody = await response.text();
              Logger.error(`Error en la petición a Ollama: ${response.statusText}`, { status: response.status, body: errorBody });
              throw new Error(`Error en la petición: ${response.statusText}`);
          }

          const data = await response.json();
          Logger.log("Respuesta recibida de Ollama:", data);
          
          return {
              response: data.response || '',
              prompt: prompt
          };
      } catch (error) {
          Logger.error('Fallo la llamada a la API de Ollama.', error);
          if (error instanceof Error && error.name === 'AbortError') {
              vscode.window.showErrorMessage('Tiempo de espera agotado en la generación de texto.');
          } else {
              vscode.window.showErrorMessage(`Error en la generación: ${(error as Error).message}`);
          }
          return null;
      }
  }
}