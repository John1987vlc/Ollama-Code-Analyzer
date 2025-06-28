import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { Readable } from 'stream';

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export interface OllamaGenerateOptions {
  temperature?: number;
  top_k?: number;
  top_p?: number;
  num_predict?: number;
  stop?: string[];
  stream?: boolean;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaService {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = 'http://localhost:11434', timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Verifica si el servicio de Ollama está disponible
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtiene la lista de modelos disponibles
   */
  async getModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Error al obtener modelos: ${response.statusText}`);
      }

      const rawData: unknown = await response.json();
      
      // Validar que la respuesta tenga la estructura esperada
      if (typeof rawData === 'object' && rawData !== null && 'models' in rawData) {
        const data = rawData as { models: any[] };
        return Array.isArray(data.models) ? data.models : [];
      }

      return [];
    } catch (error) {
      console.error('Error obteniendo modelos de Ollama:', error);
      vscode.window.showErrorMessage('No se pudieron obtener los modelos de Ollama');
      return [];
    }
  }

  /**
   * Valida si un objeto tiene la estructura de OllamaResponse
   */
  private isValidOllamaResponse(obj: any): obj is OllamaResponse {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.model === 'string' &&
      typeof obj.created_at === 'string' &&
      typeof obj.response === 'string' &&
      typeof obj.done === 'boolean'
    );
  }

  /**
   * Genera texto usando un modelo de Ollama
   */
  async generate(prompt: string, model: string, options: OllamaGenerateOptions = {}): Promise<OllamaResponse | null> {
    try {
      // Validar que el prompt no esté vacío
      if (!prompt.trim()) {
        throw new Error('El prompt no puede estar vacío');
      }

      // Validar que el modelo esté especificado
      if (!model.trim()) {
        throw new Error('Debe especificar un modelo');
      }

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
          { role: "user", content: prompt }
        ],
          stream: false, // Es crucial para recibir una única respuesta JSON
          ...options,
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`El modelo "${model}" no fue encontrado. Asegúrese de que esté instalado.`);
        }
        throw new Error(`Error de la API de Ollama: ${response.status} ${response.statusText}`);
      }

      const rawData: unknown = await response.json();
      
      // Validar que la respuesta tenga el formato esperado
      if (!this.isValidOllamaResponse(rawData)) {
        console.error('Respuesta inválida de Ollama:', rawData);
        throw new Error('Respuesta inválida del servidor Ollama');
      }

      return rawData;
    } catch (error) {
      console.error('Fallo al comunicarse con Ollama:', error);
      
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          vscode.window.showErrorMessage('Timeout: La solicitud a Ollama tardó demasiado tiempo');
        } else if (error.message.includes('fetch')) {
          vscode.window.showErrorMessage('No se pudo conectar con el servicio local de Ollama. Asegúrese de que esté en ejecución.');
        } else {
          vscode.window.showErrorMessage(`Error de Ollama: ${error.message}`);
        }
      }
      
      return null;
    }
  }

  /**
   * Genera texto con streaming (para respuestas en tiempo real)
   */
  
async generateStream(
  prompt: string,
  model: string,
  options: OllamaGenerateOptions = {},
  onChunk?: (chunk: string) => void
): Promise<string> {
  try {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "user", content: prompt }
        ],
        stream: true,
        ...options,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error de la API de Ollama: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No se pudo leer la respuesta');
    }

    const reader = response.body as Readable;
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    for await (const chunkBuffer of reader) {
      buffer += decoder.decode(chunkBuffer, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) {continue;}
        try {
          const data = JSON.parse(line);
          if (data?.response && typeof data.response === 'string') {
            fullResponse += data.response;
            onChunk?.(data.response);
          }
          if (data?.done === true) {
            return fullResponse;
          }
        } catch {
          // Ignorar error JSON
        }
      }
    }

    // Procesar restos en buffer
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        if (data?.response && typeof data.response === 'string') {
          fullResponse += data.response;
          onChunk?.(data.response);
        }
      } catch {}
    }

    return fullResponse;

  } catch (error) {
    console.error('Error en generateStream:', error);
    vscode.window.showErrorMessage('Error al generar respuesta con streaming');
    return '';
  }
}

  /**
   * Actualiza la URL base del servicio
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Actualiza el timeout de las solicitudes
   */
  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }
}