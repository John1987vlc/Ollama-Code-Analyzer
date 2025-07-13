import * as vscode from 'vscode';
import { GiteaService, GiteaIssue, GiteaPullRequest, GiteaCommit } from '../api/GiteaService';
import { OllamaService } from '../api/OllamaService';
import { getRelativeFilePath } from '../utils/pathUtils';

// --- Interfaces (sin cambios) ---
export interface LLMCodeAnalysis {
  analysis: string;
  suggestions: string[];
  risks: string[];
  opportunities: string[];
}

export interface GitContext {
  recentCommits: GiteaCommit[];
  relatedIssues: GiteaIssue[];
  relatedPullRequests: GiteaPullRequest[];
  fileStats: {
    totalCommitsInRepo: number;
    lastModified: string;
    mainContributors: string[];
  };
}

export interface EnhancedAnalysisResult {
  llmAnalysis: LLMCodeAnalysis;
  gitContext: GitContext;
  relatedTasks: Array<{
    type: 'issue' | 'pr';
    id: number;
    title: string;
    url: string;
    relevance: 'high' | 'medium';
  }>;
}

export class GitContextAnalyzer {
  constructor(
    private giteaService: GiteaService,
    private ollamaService: OllamaService
  ) {}

  /**
   * Orquesta el análisis completo de un archivo, combinando el análisis de código
   * con el contexto obtenido de Gitea.
   */
  async analyzeFileWithGitContext(
    document: vscode.TextDocument,
    modelOverride?: string
  ): Promise<EnhancedAnalysisResult | null> {
    try {
      // [MEJORA] Verificar si Gitea está configurado antes de hacer nada.
      if (!await this.giteaService.isConfigured()) {
        vscode.window.showInformationMessage('La configuración de Gitea está incompleta. Se realizará un análisis sin contexto Git.');
        // Aquí podrías optar por devolver un análisis básico o simplemente null.
        return null; 
      }

      const relativePath = getRelativeFilePath(document.uri);
      if (!relativePath) {
        vscode.window.showWarningMessage('El archivo no parece estar en el espacio de trabajo actual.');
        return null;
      }

      // Obtener todo el contexto en paralelo para mayor eficiencia
      const [gitContext, relatedTasks] = await Promise.all([
        this.getGitContext(relativePath),
        this.findRelatedTasks(relativePath),
      ]);

      if (!gitContext) return null;

      const llmAnalysis = await this.analyzeCodeWithContext(document, gitContext, modelOverride);

      if (!llmAnalysis) return null;

      return {
        llmAnalysis,
        gitContext,
        relatedTasks,
      };
    } catch (error) {
      console.error('Error durante el análisis contextual con Git:', error);
      vscode.window.showErrorMessage(`Error en análisis contextual: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return null;
    }
  }

  /**
   * Recopila el contexto de Git para un archivo específico.
   */
  private async getGitContext(filePath: string): Promise<GitContext | null> {
    // [CORRECCIÓN] Usar los nombres de método correctos del servicio Gitea
    const [recentCommits, relatedIssues, relatedPullRequests] = await Promise.all([
      this.giteaService.getCommitsForFile(filePath, 5),
      this.giteaService.searchIssues(filePath), 
      this.giteaService.searchPullRequests(filePath)
    ]);

    const contributors = recentCommits
      .map(commit => commit.author?.login || commit.commit.author.name)
      .filter((author, index, self) => self.indexOf(author) === index && author);

    const fileStats = {
      totalCommitsInRepo: recentCommits.length,
      lastModified: recentCommits[0]?.commit.author.date || 'N/A',
      mainContributors: contributors.slice(0, 3),
    };

    return {
      recentCommits,
      relatedIssues,
      relatedPullRequests,
      fileStats,
    };
  }

  /**
   * Invoca al LLM con un prompt enriquecido para analizar el código.
   */
  
    private async analyzeCodeWithContext(
        document: vscode.TextDocument,
        gitContext: GitContext,
        modelOverride?: string
    ): Promise<LLMCodeAnalysis | null> {
        const config = vscode.workspace.getConfiguration('ollamaCodeAnalyzer');
        // [CORREGIDO] Se elimina el fallback
        const model = modelOverride || config.get<string>('model');

        if (!model) {
            vscode.window.showErrorMessage("No se ha configurado un modelo de Ollama en los ajustes para el análisis contextual.");
            return null;
        }
    const recentChanges = gitContext.recentCommits
      .slice(0, 3)
      .map(commit => `- "${commit.commit.message.split('\n')[0]}" por ${commit.commit.author.name}`) // Tomar solo la primera línea del mensaje
      .join('\n');
    
    // [MEJORA] Formato de fecha seguro
    const lastModifiedDate = gitContext.fileStats.lastModified !== 'N/A' 
      ? new Date(gitContext.fileStats.lastModified).toLocaleDateString() 
      : 'N/A';

    const prompt = `Eres un ingeniero de software senior experto en revisiones de código. Analiza el siguiente fragmento de código en el contexto de su historial de desarrollo.

**Código a Analizar (${document.languageId}):**
\`\`\`${document.languageId}
${document.getText()}
\`\`\`

**Contexto de Desarrollo (Gitea):**
- **Últimos Cambios:**
${recentChanges || '  - Sin commits recientes para este archivo.'}
- **Issues y PRs Relacionados:**
${gitContext.relatedIssues.length > 0 ? `  - ${gitContext.relatedIssues.length} issues encontrados.` : '  - No se encontraron issues directamente relacionados.'}
${gitContext.relatedPullRequests.length > 0 ? `  - ${gitContext.relatedPullRequests.length} PRs encontrados.` : '  - No se encontraron PRs directamente relacionados.'}
- **Estadísticas del Archivo:**
  - Contribuidores Principales: ${gitContext.fileStats.mainContributors.join(', ') || 'N/A'}
  - Última Modificación: ${lastModifiedDate}

**Tu Tarea:**
Basado en el código y su contexto, proporciona un análisis estructurado. Considera lo siguiente:
1.  **Calidad y Lógica:** Errores, bugs potenciales, "code smells".
2.  **Consistencia Contextual:** ¿El código parece alineado con los mensajes de commit recientes? ¿Aborda alguno de los issues?
3.  **Mantenibilidad y Riesgos:** ¿Hay deuda técnica? Si los commits recientes son "fixes", ¿hay riesgo de regresión? Sugiere añadir tests si es apropiado. Si el archivo cambia mucho, sugiere mejorar la documentación.
4.  **Oportunidades de Mejora:** Refactorizaciones, optimizaciones o simplificaciones.

**Formato de Respuesta:**
Responde únicamente con un objeto JSON válido, sin texto adicional antes o después.
{
  "analysis": "Un resumen detallado de la calidad del código en relación a su contexto.",
  "suggestions": ["Sugerencia de mejora concreta y accionable.", "Otra sugerencia..."],
  "risks": ["Riesgo potencial identificado.", "Otro riesgo..."],
  "opportunities": ["Oportunidad de refactorización o mejora.", "Otra oportunidad..."]
}`;

    const rawResponse = await this.ollamaService.generate(prompt, model, { temperature: 0.2 });
    if (!rawResponse?.response) {
      throw new Error('Ollama no devolvió una respuesta.');
    }

    try {
      const jsonMatch = rawResponse.response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('La respuesta de Ollama no contenía un JSON válido.');
      
      return JSON.parse(jsonMatch[0]) as LLMCodeAnalysis;
    } catch (error) {
      console.error('Error al parsear la respuesta JSON de Ollama:', error);
      console.log('Respuesta recibida:', rawResponse.response);
      throw new Error('No se pudo interpretar la respuesta del análisis de Ollama.');
    }
  }

  /**
   * Utiliza métodos de búsqueda para encontrar issues y PRs relacionados de forma eficiente.
   */
  private async findRelatedTasks(filePath: string): Promise<EnhancedAnalysisResult['relatedTasks']> {
    // [CORRECCIÓN] Usar los nombres de método correctos del servicio Gitea
    const [issues, pullRequests] = await Promise.all([
      this.giteaService.searchIssues(filePath, 'open'),
      this.giteaService.searchPullRequests(filePath, 'open'),
    ]);

    const relatedTasks: EnhancedAnalysisResult['relatedTasks'] = [];

    issues.forEach(issue => relatedTasks.push({
      type: 'issue',
      id: issue.number,
      title: issue.title,
      url: issue.html_url,
      relevance: 'high',
    }));

    pullRequests.forEach(pr => relatedTasks.push({
      type: 'pr',
      id: pr.number,
      title: pr.title,
      url: pr.html_url,
      relevance: 'high',
    }));

    return relatedTasks;
  }
}