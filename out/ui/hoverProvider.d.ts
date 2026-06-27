import * as vscode from 'vscode';
import { EntropyDatabase } from '../database';
/**
 * Provides hover information for imported files showing their entropy score.
 *
 * When hovering over an import/require statement, resolves the imported
 * file and displays its entropy metrics as a rich Markdown hover card.
 */
export declare class EntropyHoverProvider implements vscode.HoverProvider {
    private db;
    private workspacePath;
    constructor(db: EntropyDatabase, workspacePath: string);
    /**
     * Provides hover content for import statements.
     */
    provideHover(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover>;
    /**
     * Extracts the import path from a line of code.
     */
    private extractImportPath;
    /**
     * Resolves an import path to a workspace-relative file path.
     *
     * Handles:
     * - Relative imports (./foo, ../bar)
     * - Tries common file extensions if not specified
     * - Tries index files for directory imports
     */
    private resolveImportPath;
    /**
     * Checks if a file exists in the database and returns its
     * workspace-relative path, or null.
     */
    private tryResolve;
    /**
     * Builds a rich Markdown hover card for a file's entropy data.
     */
    private buildHoverMarkdown;
}
//# sourceMappingURL=hoverProvider.d.ts.map