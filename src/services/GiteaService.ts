import * as vscode from 'vscode';
import fetch from 'node-fetch';

// --- INTERFACES MEJORADAS Y DOCUMENTADAS ---

/**
 * Configuración para la conexión con la instancia de Gitea.
 */
export interface GiteaConfig {
  baseUrl: string;
  token: string;
  organization?: string;
  repository?: string;
}

/**
 * Representa un Issue de Gitea.
 */
export interface GiteaIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  html_url: string; // [AÑADIDO] URL visible en el navegador.
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string; };
  labels: Array<{ name: string; color: string; }>;
  assignees: Array<{ login: string; avatar_url: string; }>;
}

/**
 * Representa un Pull Request de Gitea.
 */
export interface GiteaPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  html_url: string; // [AÑADIDO] URL visible en el navegador.
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string; };
  head: { ref: string; sha: string; };
  base: { ref: string; sha: string; };
}

/**
 * Representa un Commit de Gitea.
 */
export interface GiteaCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string; };
  };
  author: { login: string; avatar_url: string; } | null;
}

/**
 * Representa los cambios de un archivo en un commit específico.
 */
export interface FileChange {
  filename: string;
  status: 'added' | 'modified' | 'removed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export class GiteaService {
  private config: GiteaConfig;
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Gitea Integration');
    this.config = this.loadConfig();
    
    // Listener para recargar la configuración si cambia
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('ollamaCodeAnalyzer.gitea')) {
            this.outputChannel.appendLine('Configuración de Gitea actualizada, recargando servicio...');
            this.config = this.loadConfig();
        }
    });
  }

  /**
   * Carga la configuración desde los ajustes de VS Code.
   */
  private loadConfig(): GiteaConfig {
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer.gitea');
    return {
      baseUrl: config.get<string>('baseUrl', '').replace(/\/$/, ''), // Eliminar barra final si existe
      token: config.get<string>('token', ''),
      organization: config.get<string>('organization', ''),
      repository: config.get<string>('repository', '')
    };
  }

  /**
   * Verifica si la configuración esencial (URL y token) está presente.
   */
  async isConfigured(): Promise<boolean> {
    return !!(this.config.baseUrl && this.config.token && this.config.organization && this.config.repository);
  }

  /**
   * [MODIFICADO] Realiza una petición a la API de Gitea de forma centralizada y robusta.
   */
  private async makeRequest<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<T | null> {
    if (!await this.isConfigured()) {
        // No mostramos error aquí, el llamador decidirá.
        return null; 
    }

    try {
        const url = `${this.config.baseUrl}/api/v1${endpoint}`;
        this.outputChannel.appendLine(`Gitea Request: ${method} ${url}`);
        
        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `token ${this.config.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`[${response.status}] ${response.statusText}: ${errorBody}`);
        }

        // Maneja respuestas vacías (ej. 204 No Content)
        if (response.status === 204) {
            return null;
        }

        return await response.json() as T;

    } catch (error) {
        this.handleApiError(error);
        return null;
    }
  }

  /**
   * [MODIFICADO] Obtiene la ruta del repositorio para las URLs de la API.
   */
  private getRepoPath(): string | null {
    const { organization, repository } = this.config;
    if (!organization || !repository) {
      // Este error debería ser prevenido por isConfigured, pero es una salvaguarda.
      return null;
    }
    return `/repos/${organization}/${repository}`;
  }
  
  // --- MÉTODOS DE BÚSQUEDA EFICIENTES ---

  /**
   * [NUEVO Y MEJORADO] Busca issues en el repositorio que coincidan con una query.
   * @param query El término de búsqueda.
   * @param state El estado de los issues a buscar.
   */
  async searchIssues(query: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GiteaIssue[]> {
    const repoPath = this.getRepoPath();
    if (!repoPath) return [];
    
    const searchQuery = encodeURIComponent(query);
    const result = await this.makeRequest<{ok: boolean, data: GiteaIssue[]}>(`${repoPath}/issues/search?state=${state}&q=${searchQuery}`);
    return result?.data || [];
  }

  /**
   * [NUEVO] Busca Pull Requests en el repositorio que coincidan con una query.
   * @param query El término de búsqueda.
   * @param state El estado de los PRs a buscar.
   */
  async searchPullRequests(query: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GiteaPullRequest[]> {
    const repoPath = this.getRepoPath();
    if (!repoPath) return [];

    const searchQuery = encodeURIComponent(query);
    const result = await this.makeRequest<{ok: boolean, data: GiteaPullRequest[]}>(`${repoPath}/pulls/search?state=${state}&q=${searchQuery}`);
    return result?.data || [];
  }

  /**
   * Obtiene los commits más recientes que han modificado un archivo específico.
   * @param filePath Ruta del archivo relativa a la raíz del repositorio.
   * @param limit Número máximo de commits a devolver.
   */
  async getCommitsForFile(filePath: string, limit: number = 10): Promise<GiteaCommit[]> {
    const repoPath = this.getRepoPath();
    if (!repoPath) return [];

    const commits = await this.makeRequest<GiteaCommit[]>(`${repoPath}/commits?path=${encodeURIComponent(filePath)}&limit=${limit}`);
    return commits || [];
  }
  
  /**
   * Crea un nuevo issue en el repositorio de Gitea.
   */
  async createIssue(title: string, body: string, labels?: string[]): Promise<GiteaIssue | null> {
    const repoPath = this.getRepoPath();
    if (!repoPath) return null;

    const issueData = { title, body, labels: labels || [] };
    return this.makeRequest<GiteaIssue>(`${repoPath}/issues`, 'POST', issueData);
  }
  
  /**
   * Guarda la configuración de Gitea en los ajustes de VS Code.
   */
  async saveConfiguration(baseUrl: string, token: string, organization: string, repository: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer.gitea');
    await Promise.all([
        config.update('baseUrl', baseUrl, vscode.ConfigurationTarget.Global),
        config.update('token', token, vscode.ConfigurationTarget.Global),
        config.update('organization', organization, vscode.ConfigurationTarget.Global),
        config.update('repository', repository, vscode.ConfigurationTarget.Global)
    ]);
    this.config = this.loadConfig(); // Recarga inmediata
  }

  /**
   * [NUEVO] Centraliza el manejo de errores de la API para notificar al usuario.
   */
  private handleApiError(error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(`Error en la API de Gitea: ${errorMessage}`);
    console.error('Gitea API Error:', error);

    // Muestra un mensaje no intrusivo al usuario.
    vscode.window.showErrorMessage(`Gitea: ${errorMessage}`, { modal: false });
  }
 async testConnection(): Promise<boolean> {
    try {
      // Llamamos a un endpoint que requiere autenticación pero es ligero, como obtener el usuario.
      const user = await this.makeRequest<any>('/user');
      return user !== null;
    } catch (error) {
      return false;
    }
  }
}
