import * as vscode from 'vscode';

export interface GiteaConfig {
  baseUrl: string;
  token: string;
  organization?: string;
  repository?: string;
}

export interface GiteaIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
  assignees: Array<{
    login: string;
    avatar_url: string;
  }>;
}

export interface GiteaPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

export interface GiteaCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
}

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
  }

  private loadConfig(): GiteaConfig {
    const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer.gitea');
    return {
      baseUrl: config.get<string>('baseUrl', ''),
      token: config.get<string>('token', ''),
      organization: config.get<string>('organization', ''),
      repository: config.get<string>('repository', '')
    };
  }

  async isConfigured(): Promise<boolean> {
    this.config = this.loadConfig();
    return !!(this.config.baseUrl && this.config.token);
  }

private async makeRequest<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<T | null> {
  if (!await this.isConfigured()) {
    vscode.window.showErrorMessage('Gitea no está configurado. Configure la URL base y token.');
    return null;
  }

  try {
    const url = `${this.config.baseUrl}/api/v1${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `token ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Gitea API error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    const text = await response.text();

    if (contentType && contentType.includes('application/json')) {
      return JSON.parse(text);
    } else {
      this.outputChannel.appendLine('La respuesta no es JSON. Texto devuelto: ' + text);
      return null;
    }
  } catch (error) {
    this.outputChannel.appendLine(`Error en solicitud a Gitea: ${error}`);
    console.error('Gitea API error:', error);
    return null;
  }
}


  private getRepoPath(): string {
    const { organization, repository } = this.config;
    if (!organization || !repository) {
      throw new Error('Organización y repositorio deben estar configurados');
    }
    return `${organization}/${repository}`;
  }

  async getIssues(state: 'open' | 'closed' | 'all' = 'open'): Promise<GiteaIssue[]> {
    try {
      const repoPath = this.getRepoPath();
      const issues = await this.makeRequest<GiteaIssue[]>(`/repos/${repoPath}/issues?state=${state}`);
      return issues || [];
    } catch (error) {
      this.outputChannel.appendLine(`Error obteniendo issues: ${error}`);
      return [];
    }
  }

  async getPullRequests(state: 'open' | 'closed' | 'all' = 'open'): Promise<GiteaPullRequest[]> {
    try {
      const repoPath = this.getRepoPath();
      const prs = await this.makeRequest<GiteaPullRequest[]>(`/repos/${repoPath}/pulls?state=${state}`);
      return prs || [];
    } catch (error) {
      this.outputChannel.appendLine(`Error obteniendo pull requests: ${error}`);
      return [];
    }
  }

  async getCommitsForFile(filePath: string, limit: number = 10): Promise<GiteaCommit[]> {
    try {
      const repoPath = this.getRepoPath();
      const commits = await this.makeRequest<GiteaCommit[]>(`/repos/${repoPath}/commits?path=${encodeURIComponent(filePath)}&limit=${limit}`);
      return commits || [];
    } catch (error) {
      this.outputChannel.appendLine(`Error obteniendo commits para ${filePath}: ${error}`);
      return [];
    }
  }

  async getFileChangesInCommit(sha: string): Promise<FileChange[]> {
    try {
      const repoPath = this.getRepoPath();
      const commit = await this.makeRequest<{ files: FileChange[] }>(`/repos/${repoPath}/commits/${sha}`);
      return commit?.files || [];
    } catch (error) {
      this.outputChannel.appendLine(`Error obteniendo cambios del commit ${sha}: ${error}`);
      return [];
    }
  }

  async searchIssuesForFile(filename: string): Promise<GiteaIssue[]> {
    try {
      const repoPath = this.getRepoPath();
      const searchQuery = encodeURIComponent(`${filename} in:body`);
      const issues = await this.makeRequest<GiteaIssue[]>(`/repos/${repoPath}/issues?q=${searchQuery}`);
      return issues || [];
    } catch (error) {
      this.outputChannel.appendLine(`Error buscando issues para ${filename}: ${error}`);
      return [];
    }
  }

  async createIssue(title: string, body: string, labels?: string[]): Promise<GiteaIssue | null> {
    try {
      const repoPath = this.getRepoPath();
      const issueData = {
        title,
        body,
        labels: labels || []
      };
      
      const issue = await this.makeRequest<GiteaIssue>(`/repos/${repoPath}/issues`, 'POST', issueData);
      return issue;
    } catch (error) {
      this.outputChannel.appendLine(`Error creando issue: ${error}`);
      return null;
    }
  }
  async saveConfiguration(baseUrl: string, token: string, organization?: string, repository?: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer.gitea');

  await config.update('baseUrl', baseUrl, vscode.ConfigurationTarget.Global);
  await config.update('token', token, vscode.ConfigurationTarget.Global);

  if (organization !== undefined) {
    await config.update('organization', organization, vscode.ConfigurationTarget.Global);
  }

  if (repository !== undefined) {
    await config.update('repository', repository, vscode.ConfigurationTarget.Global);
  }

  // Recarga la configuración interna
  this.config = this.loadConfig();
}

}
