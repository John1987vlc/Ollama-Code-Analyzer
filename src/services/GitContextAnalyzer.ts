import * as vscode from 'vscode';
import * as path from 'path';
import { GiteaService, GiteaIssue, GiteaPullRequest, GiteaCommit } from './GiteaService';
import { OllamaService } from './OllamaService';

export interface GitContext {
  recentCommits: GiteaCommit[];
  relatedIssues: GiteaIssue[];
  relatedPullRequests: GiteaPullRequest[];
  fileHistory: {
    totalCommits: number;
    lastModified: string;
    mainContributors: string[];
  };
}

export interface EnhancedAnalysisResult {
  codeAnalysis: string;
  gitContext: GitContext;
  contextualSuggestions: string[];
  relatedTasks: Array<{
    type: 'issue' | 'pr';
    id: number;
    title: string;
    relevance: 'high' | 'medium' | 'low';
  }>;
}

export class GitContextAnalyzer {
  constructor(
    private giteaService: GiteaService,
    private ollamaService: OllamaService
  ) {}

  async analyzeFileWithGitContext(document: vscode.TextDocument): Promise<EnhancedAnalysisResult | null> {
    try {
      const relativePath = this.getRelativeFilePath(document.uri);
      if (!relativePath) {
        return null;
      }

      // Obtener contexto de Git
      const gitContext = await this.getGitContext(relativePath);
      
      // Analizar código con contexto
      const codeAnalysis = await this.analyzeCodeWithContext(document, gitContext);
      
      // Encontrar tareas relacionadas
      const relatedTasks = await this.findRelatedTasks(relativePath, document.getText());
      
      // Generar sugerencias contextuales
      const contextualSuggestions = await this.generateContextualSuggestions(
        document.getText(),
        gitContext,
        document.languageId
      );

      return {
        codeAnalysis,
        gitContext,
        contextualSuggestions,
        relatedTasks
      };
    } catch (error) {
      console.error('Error en análisis con contexto Git:', error);
      return null;
    }
  }

  private async getGitContext(filePath: string): Promise<GitContext> {
    const [recentCommits, relatedIssues, relatedPullRequests] = await Promise.all([
      this.giteaService.getCommitsForFile(filePath, 5),
      this.giteaService.searchIssuesForFile(path.basename(filePath)),
      this.giteaService.getPullRequests('all')
    ]);

    // Calcular estadísticas del archivo
    const contributors = recentCommits
      .map(commit => commit.author?.login || commit.commit.author.name)
      .filter((author, index, self) => self.indexOf(author) === index);

    const fileHistory = {
      totalCommits: recentCommits.length,
      lastModified: recentCommits[0]?.commit.author.date || '',
      mainContributors: contributors.slice(0, 3)
    };

    return {
      recentCommits,
      relatedIssues,
      relatedPullRequests: relatedPullRequests.filter(pr => 
        pr.title.toLowerCase().includes(path.basename(filePath).toLowerCase()) ||
        pr.body.toLowerCase().includes(path.basename(filePath).toLowerCase())
      ),
      fileHistory
    };
  }

  private async analyzeCodeWithContext(document: vscode.TextDocument, gitContext: GitContext): Promise<string> {
    const recentChanges = gitContext.recentCommits
      .slice(0, 3)
      .map(commit => `- ${commit.commit.message} (${commit.commit.author.name})`)
      .join('\n');

    const relatedIssues = gitContext.relatedIssues
      .slice(0, 3)
      .map(issue => `- #${issue.number}: ${issue.title}`)
      .join('\n');

    const prompt = `Analiza el siguiente código considerando su contexto de desarrollo:

CÓDIGO:
\`\`\`${document.languageId}
${document.getText()}
\`\`\`

CONTEXTO DE GIT:
Cambios recientes:
${recentChanges || 'Sin cambios recientes'}

Issues relacionados:
${relatedIssues || 'Sin issues relacionados'}

Historial del archivo:
- Total de commits: ${gitContext.fileHistory.totalCommits}
- Última modificación: ${gitContext.fileHistory.lastModified}
- Principales contribuidores: ${gitContext.fileHistory.mainContributors.join(', ')}

Por favor, proporciona un análisis que considere:
1. Calidad del código actual
2. Consistencia con los cambios recientes
3. Relación con las tareas pendientes
4. Posibles mejoras basadas en el historial

Responde en formato JSON:
{
  "analysis": "análisis_detallado",
  "suggestions": ["sugerencia1", "sugerencia2"],
  "risks": ["riesgo1", "riesgo2"],
  "opportunities": ["oportunidad1", "oportunidad2"]
}`;

    const response = await this.ollamaService.generate(prompt, 'codellama', {
      temperature: 0.2,
      top_p: 0.9
    });

    return response?.response || 'No se pudo obtener análisis contextual';
  }

  private async findRelatedTasks(filePath: string, code: string): Promise<Array<{
    type: 'issue' | 'pr';
    id: number;
    title: string;
    relevance: 'high' | 'medium' | 'low';
  }>> {
    const fileName = path.basename(filePath);
    const [issues, pullRequests] = await Promise.all([
      this.giteaService.getIssues('open'),
      this.giteaService.getPullRequests('open')
    ]);

    const relatedTasks = [];

    // Buscar issues relacionados
    for (const issue of issues) {
      let relevance: 'high' | 'medium' | 'low' = 'low';
      
      if (issue.title.toLowerCase().includes(fileName.toLowerCase()) ||
          issue.body.toLowerCase().includes(fileName.toLowerCase())) {
        relevance = 'high';
      } else if (issue.body.toLowerCase().includes(path.dirname(filePath).toLowerCase())) {
        relevance = 'medium';
      }

      if (relevance !== 'low') {
        relatedTasks.push({
          type: 'issue' as const,
          id: issue.number,
          title: issue.title,
          relevance
        });
      }
    }

    // Buscar PRs relacionados
    for (const pr of pullRequests) {
      let relevance: 'high' | 'medium' | 'low' = 'low';
      
      if (pr.title.toLowerCase().includes(fileName.toLowerCase()) ||
          pr.body.toLowerCase().includes(fileName.toLowerCase())) {
        relevance = 'high';
      } else if (pr.body.toLowerCase().includes(path.dirname(filePath).toLowerCase())) {
        relevance = 'medium';
      }

      if (relevance !== 'low') {
        relatedTasks.push({
          type: 'pr' as const,
          id: pr.number,
          title: pr.title,
          relevance
        });
      }
    }

    return relatedTasks.sort((a, b) => {
      const relevanceOrder = { high: 3, medium: 2, low: 1 };
      return relevanceOrder[b.relevance] - relevanceOrder[a.relevance];
    });
  }

  private async generateContextualSuggestions(
    code: string,
    gitContext: GitContext,
    language: string
  ): Promise<string[]> {
    const suggestions = [];

    // Sugerencias basadas en el historial
    if (gitContext.fileHistory.totalCommits > 10) {
      suggestions.push('Este archivo ha sido modificado frecuentemente. Considera añadir más documentación.');
    }

    if (gitContext.recentCommits.length > 0) {
      const lastCommit = gitContext.recentCommits[0];
      if (lastCommit.commit.message.toLowerCase().includes('fix') || 
          lastCommit.commit.message.toLowerCase().includes('bug')) {
        suggestions.push('Archivo con correcciones recientes. Considera añadir tests para prevenir regresiones.');
      }
    }

    // Sugerencias basadas en issues
    const openIssues = gitContext.relatedIssues.filter(issue => issue.state === 'open');
    if (openIssues.length > 0) {
      suggestions.push(`Hay ${openIssues.length} issue(s) abierto(s) relacionado(s) con este archivo.`);
    }

    return suggestions;
  }

  private getRelativeFilePath(uri: vscode.Uri): string | null {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return null;
    }

    return path.relative(workspaceFolder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
  }
}