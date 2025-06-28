import * as vscode from 'vscode';
import { GiteaService, GiteaIssue, GiteaPullRequest, GiteaCommit } from '../services/GiteaService';

export class GitContextTreeProvider implements vscode.TreeDataProvider<GitContextItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<GitContextItem | undefined | null | void> = new vscode.EventEmitter<GitContextItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<GitContextItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private currentFile: string | null = null;

  constructor(private giteaService: GiteaService) {}

  refresh(filePath?: string): void {
    this.currentFile = filePath || null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: GitContextItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: GitContextItem): Promise<GitContextItem[]> {
    if (!await this.giteaService.isConfigured()) {
      return [new GitContextItem('Gitea no configurado', vscode.TreeItemCollapsibleState.None, 'error')];
    }

    if (!element) {
      return [
        new GitContextItem('Issues Relacionados', vscode.TreeItemCollapsibleState.Collapsed, 'issues'),
        new GitContextItem('Pull Requests', vscode.TreeItemCollapsibleState.Collapsed, 'pulls'),
        new GitContextItem('Commits Recientes', vscode.TreeItemCollapsibleState.Collapsed, 'commits')
      ];
    }

    if (!this.currentFile) {
      return [new GitContextItem('Selecciona un archivo para ver el contexto', vscode.TreeItemCollapsibleState.None, 'info')];
    }

    switch (element.contextType) {
      case 'issues':
        const issues = await this.giteaService.searchIssuesForFile(this.currentFile);
        return issues.map(issue => new GitContextItem(
          `#${issue.number}: ${issue.title}`,
          vscode.TreeItemCollapsibleState.None,
          'issue',
          {
            command: 'ollamaCodeAnalyzer.openIssue',
            title: 'Abrir Issue',
            arguments: [issue]
          }
        ));

      case 'pulls':
        const pulls = await this.giteaService.getPullRequests('open');
        const relatedPulls = pulls.filter(pr => 
          pr.title.toLowerCase().includes(this.currentFile!.toLowerCase()) ||
          pr.body.toLowerCase().includes(this.currentFile!.toLowerCase())
        );
        return relatedPulls.map(pr => new GitContextItem(
          `#${pr.number}: ${pr.title}`,
          vscode.TreeItemCollapsibleState.None,
          'pull',
          {
            command: 'ollamaCodeAnalyzer.openPullRequest',
            title: 'Abrir PR',
            arguments: [pr]
          }
        ));

      case 'commits':
        const commits = await this.giteaService.getCommitsForFile(this.currentFile, 5);
        return commits.map(commit => new GitContextItem(
          `${commit.sha.substring(0, 7)}: ${commit.commit.message}`,
          vscode.TreeItemCollapsibleState.None,
          'commit',
          {
            command: 'ollamaCodeAnalyzer.openCommit',
            title: 'Ver Commit',
            arguments: [commit]
          }
        ));

      default:
        return [];
    }
  }
}

export class GitContextItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextType: string,
    command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.command = command;
    this.contextValue = contextType;

    // Iconos según el tipo
    switch (contextType) {
      case 'issues':
        this.iconPath = new vscode.ThemeIcon('issues');
        break;
      case 'pulls':
        this.iconPath = new vscode.ThemeIcon('git-pull-request');
        break;
      case 'commits':
        this.iconPath = new vscode.ThemeIcon('git-commit');
        break;
      case 'issue':
        this.iconPath = new vscode.ThemeIcon('issue-opened');
        break;
      case 'pull':
        this.iconPath = new vscode.ThemeIcon('git-pull-request');
        break;
      case 'commit':
        this.iconPath = new vscode.ThemeIcon('git-commit');
        break;
      case 'error':
        this.iconPath = new vscode.ThemeIcon('error');
        break;
      case 'info':
        this.iconPath = new vscode.ThemeIcon('info');
        break;
    }
  }
}