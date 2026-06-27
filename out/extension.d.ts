import * as vscode from 'vscode';
/**
 * Extension activation point.
 *
 * Called when the workspace contains a .git folder (see activationEvents).
 * Sets up all providers, runs initial analysis in background, and
 * registers commands.
 */
export declare function activate(context: vscode.ExtensionContext): Promise<void>;
/**
 * Extension deactivation hook.
 * Cleans up the database connection.
 */
export declare function deactivate(): void;
//# sourceMappingURL=extension.d.ts.map