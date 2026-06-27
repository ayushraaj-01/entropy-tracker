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
export declare class EntropyDecorationProvider implements vscode.FileDecorationProvider {
    private db;
    private workspacePath;
    private _onDidChangeFileDecorations;
    readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined>;
    constructor(db: EntropyDatabase, workspacePath: string);
    /**
     * Provides decoration for a single file URI.
     * Only decorates files with entropy scores at warning or critical level.
     */
    provideFileDecoration(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration>;
    /**
     * Fires a change event to refresh all file decorations.
     * Call this after analysis completes to update the Explorer.
     */
    refresh(): void;
    /**
     * Disposes of the event emitter.
     */
    dispose(): void;
}
//# sourceMappingURL=decorationProvider.d.ts.map