import * as vscode from 'vscode';
import { EntropyDatabase } from '../database';

/**
 * Provides file decorations in the VS Code Explorer based on entropy scores.
 *
 * Files are decorated with colored dots:
 *  - 🔴 Critical (score ≥ 70): red dot with "split this file" tooltip
 *  - 🟡 Warning  (score 40-69): amber dot with "watch this file" tooltip
 *  - Healthy (score < 40): no decoration
 */
export class EntropyDecorationProvider implements vscode.FileDecorationProvider {
  private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  constructor(
    private db: EntropyDatabase,
    private workspacePath: string
  ) {}

  /**
   * Provides decoration for a single file URI.
   * Only decorates files with entropy scores at warning or critical level.
   */
  provideFileDecoration(
    uri: vscode.Uri,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FileDecoration> {
    // Check if decorations are enabled
    const config = vscode.workspace.getConfiguration('entropy');
    if (!config.get<boolean>('showDecorationsInExplorer', true)) {
      return undefined;
    }

    // Get the relative path from workspace root
    const relativePath = vscode.workspace.asRelativePath(uri, false);

    // Skip if the URI isn't within the workspace
    if (relativePath === uri.fsPath) {
      return undefined;
    }

    // Normalize path separators
    const normalizedPath = relativePath.replace(/\\/g, '/');

    // Look up score in database
    const fileData = this.db.getScore(normalizedPath);
    if (!fileData) {
      return undefined;
    }

    const score = fileData.score;

    if (score >= 70) {
      return new vscode.FileDecoration(
        '⬤',
        `Entropy: ${score}/100 — split this file`,
        new vscode.ThemeColor('errorForeground')
      );
    }

    if (score >= 40) {
      return new vscode.FileDecoration(
        '⬤',
        `Entropy: ${score}/100 — watch this file`,
        new vscode.ThemeColor('problemsWarningIcon.foreground')
      );
    }

    // Healthy files get no decoration
    return undefined;
  }

  /**
   * Fires a change event to refresh all file decorations.
   * Call this after analysis completes to update the Explorer.
   */
  public refresh(): void {
    this._onDidChangeFileDecorations.fire(undefined);
  }

  /**
   * Disposes of the event emitter.
   */
  public dispose(): void {
    this._onDidChangeFileDecorations.dispose();
  }
}
