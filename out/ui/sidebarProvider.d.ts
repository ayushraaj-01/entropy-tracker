import * as vscode from 'vscode';
import { EntropyDatabase } from '../database';
/**
 * Provides the Entropy Tracker sidebar webview panel.
 *
 * Displays a ranked list of the highest-entropy files with:
 * - Colored severity dots
 * - Sparklines showing score history
 * - Detail view with metric cards, topic tags, author breakdown, and suggestions
 */
export declare class EntropySidebarProvider implements vscode.WebviewViewProvider {
    private extensionUri;
    private db;
    private log;
    static readonly viewType = "entropyTracker.sidebar";
    private _view?;
    constructor(extensionUri: vscode.Uri, db: EntropyDatabase, log: vscode.OutputChannel);
    /**
     * Called when the webview view is first created.
     */
    resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void;
    /**
     * Refreshes the sidebar data after analysis completes.
     */
    refresh(): void;
    /**
     * Sends the top files list to the webview.
     */
    private sendData;
    /**
     * Sends detailed data for a specific file to the webview.
     */
    private sendDetailData;
    /**
     * Opens a file in the editor.
     */
    private openFile;
    /**
     * Generates the full HTML for the sidebar webview.
     */
    private getHtml;
}
//# sourceMappingURL=sidebarProvider.d.ts.map