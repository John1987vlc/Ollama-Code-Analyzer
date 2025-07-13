import * as vscode from 'vscode';
import { GiteaService, GiteaIssue, GiteaPullRequest, GiteaCommit } from '../api/GiteaService';
import path = require('path');

// [MEJORA] Usar un tipo estricto para los contextos previene errores de tipeo.
export type GitContextType = 
  | 'root' 
  | 'issues' | 'pulls' | 'commits'
  | 'issue' | 'pull' | 'commit'
  | 'info' | 'error' | 'empty';

export class GitContextTreeProvider implements vscode.TreeDataProvider<GitContextItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<GitContextItem | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<GitContextItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private currentFile: string | null = null;
  // [MEJORA] Caché para almacenar los resultados y evitar llamadas redundantes a la API.
  private cache = new Map<string, GitContextItem[]>();

  constructor(private giteaService: GiteaService) {}

  /**
   * Refresca la vista del árbol. Se llama cuando el usuario cambia de archivo.
   * @param filePath La ruta del nuevo archivo activo.
   */
  public refresh(filePath?: string): void {
    const newFile = filePath || null;
    // Solo refresca si el archivo realmente ha cambiado.
    if (this.currentFile !== newFile) {
        this.currentFile = newFile;
        this.cache.clear(); // [MEJORA] Limpiar la caché al cambiar de archivo.
        this._onDidChangeTreeData.fire();
    }
  }

  public getTreeItem(element: GitContextItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: GitContextItem): Promise<GitContextItem[]> {
    if (!await this.giteaService.isConfigured()) {
      return [new GitContextItem('Gitea no configurado', vscode.TreeItemCollapsibleState.None, 'error')];
    }

    if (!this.currentFile) {
        return [new GitContextItem('Abre un archivo para ver su contexto de Git', vscode.TreeItemCollapsibleState.None, 'info')];
    }

    if (!element) {
      // Nivel raíz: las categorías principales.
      return [
        new GitContextItem('Issues Relacionados', vscode.TreeItemCollapsibleState.Collapsed, 'issues'),
        new GitContextItem('Pull Requests Relacionados', vscode.TreeItemCollapsibleState.Collapsed, 'pulls'),
        new GitContextItem('Commits Recientes', vscode.TreeItemCollapsibleState.Collapsed, 'commits')
      ];
    }
    
    // [MEJORA] Comprobar la caché antes de hacer una llamada a la API.
    const cacheKey = `${this.currentFile}:${element.contextType}`;
    if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
    }

    let children: GitContextItem[] = [];
    const fileName = path.basename(this.currentFile);

    switch (element.contextType) {
      case 'issues':
        // [CORRECCIÓN] Usar el método de búsqueda correcto y eficiente.
        const issues = await this.giteaService.searchIssues(fileName, 'open');
        if (issues.length === 0) {
            children = [new GitContextItem('No se encontraron issues relacionados', vscode.TreeItemCollapsibleState.None, 'empty')];
        } else {
            children = issues.map(issue => new GitContextItem(
              `#${issue.number}: ${issue.title}`,
              vscode.TreeItemCollapsibleState.None,
              'issue',
              { command: 'vscode.open', title: 'Abrir Issue en Navegador', arguments: [vscode.Uri.parse(issue.html_url)] }
            ));
        }
        break;

      case 'pulls':
        // [CORRECCIÓN] Usar el método de búsqueda de PRs, mucho más eficiente.
        const pulls = await this.giteaService.searchPullRequests(fileName, 'open');
        if (pulls.length === 0) {
            children = [new GitContextItem('No se encontraron PRs relacionados', vscode.TreeItemCollapsibleState.None, 'empty')];
        } else {
            children = pulls.map(pr => new GitContextItem(
              `#${pr.number}: ${pr.title}`,
              vscode.TreeItemCollapsibleState.None,
              'pull',
              { command: 'vscode.open', title: 'Abrir PR en Navegador', arguments: [vscode.Uri.parse(pr.html_url)] }
            ));
        }
        break;

      case 'commits':
        const commits = await this.giteaService.getCommitsForFile(this.currentFile, 5);
        if (commits.length === 0) {
            children = [new GitContextItem('No se encontraron commits para este archivo', vscode.TreeItemCollapsibleState.None, 'empty')];
        } else {
            children = commits.map(commit => {
                const shortMessage = commit.commit.message.split('\n')[0];
                const item = new GitContextItem(
                    `${commit.sha.substring(0, 7)}: ${shortMessage.length > 50 ? shortMessage.substring(0, 50) + '…' : shortMessage}`,
                    vscode.TreeItemCollapsibleState.None,
                    'commit',
                    { command: 'vscode.open', title: 'Ver Commit en Navegador', arguments: [vscode.Uri.parse(commit.html_url)] }
                );
                // [MEJORA] Añadir el mensaje completo en el tooltip.
                item.tooltip = new vscode.MarkdownString(`**${commit.commit.author.name}**\n\n${commit.commit.message}`);
                return item;
            });
        }
        break;
    }
    
    // [MEJORA] Guardar el resultado en la caché antes de devolverlo.
    this.cache.set(cacheKey, children);
    return children;
  }
}

export class GitContextItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextType: GitContextType,
    command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.command = command;
    this.contextValue = contextType;

    // Asignación de iconos basada en ThemeIcons para un look nativo de VS Code.
    const iconMap: Record<GitContextType, string> = {
        root: '',
        issues: 'issues',
        pulls: 'git-pull-request',
        commits: 'git-commit',
        issue: 'issue-opened',
        pull: 'git-pull-request-go-to-changes',
        commit: 'git-commit',
        info: 'info',
        error: 'error',
        empty: 'circle-slash'
    };
    this.iconPath = new vscode.ThemeIcon(iconMap[contextType] || 'circle-outline');
  }
}