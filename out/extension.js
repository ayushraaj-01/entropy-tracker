"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const database_1 = require("./database");
const gitAnalyzer_1 = require("./gitAnalyzer");
const scorer_1 = require("./scorer");
const decorationProvider_1 = require("./ui/decorationProvider");
const hoverProvider_1 = require("./ui/hoverProvider");
const sidebarProvider_1 = require("./ui/sidebarProvider");
/** The shared output channel for all entropy tracker logging. */
let outputChannel;
/** The shared database instance. */
let database;
/** Status bar item showing entropy score of current file. */
let statusBarItem;
/** Decoration provider instance (needs refresh calls). */
let decorationProvider;
/** Sidebar provider instance (needs refresh calls). */
let sidebarProvider;
/** Flag to prevent concurrent analysis runs. */
let isAnalyzing = false;
/**
 * Extension activation point.
 *
 * Called when the workspace contains a .git folder (see activationEvents).
 * Sets up all providers, runs initial analysis in background, and
 * registers commands.
 */
async function activate(context) {
    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Entropy Tracker');
    context.subscriptions.push(outputChannel);
    outputChannel.appendLine('[Entropy] Extension activating…');
    // Get workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showInformationMessage('Entropy Tracker: No workspace folder found. Open a folder to use this extension.');
        return;
    }
    const workspacePath = workspaceFolder.uri.fsPath;
    // Check for git repository
    const gitAnalyzer = new gitAnalyzer_1.GitAnalyzer(workspacePath, outputChannel);
    const isGit = await gitAnalyzer.isGitRepo();
    if (!isGit) {
        vscode.window.showInformationMessage('Entropy Tracker: No git repository detected in this workspace. Initialize a git repo to use entropy tracking.');
        outputChannel.appendLine('[Entropy] No git repo found. Extension will remain dormant.');
        return;
    }
    outputChannel.appendLine(`[Entropy] Git repo found at ${workspacePath}`);
    // Initialize database
    const storagePath = context.globalStorageUri.fsPath;
    database = new database_1.EntropyDatabase(storagePath);
    await database.open();
    outputChannel.appendLine(`[Entropy] Database opened at ${storagePath}`);
    // Register FileDecorationProvider
    decorationProvider = new decorationProvider_1.EntropyDecorationProvider(database, workspacePath);
    context.subscriptions.push(vscode.window.registerFileDecorationProvider(decorationProvider));
    outputChannel.appendLine('[Entropy] FileDecorationProvider registered');
    // Register HoverProvider for all file types
    const hoverProvider = new hoverProvider_1.EntropyHoverProvider(database, workspacePath);
    context.subscriptions.push(vscode.languages.registerHoverProvider({ scheme: 'file' }, hoverProvider));
    outputChannel.appendLine('[Entropy] HoverProvider registered');
    // Register Sidebar WebviewViewProvider
    sidebarProvider = new sidebarProvider_1.EntropySidebarProvider(context.extensionUri, database, outputChannel);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(sidebarProvider_1.EntropySidebarProvider.viewType, sidebarProvider, { webviewOptions: { retainContextWhenHidden: true } }));
    outputChannel.appendLine('[Entropy] Sidebar provider registered');
    // Create Status Bar Item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'entropy.openPanel';
    context.subscriptions.push(statusBarItem);
    outputChannel.appendLine('[Entropy] Status bar item created');
    // Update status bar when active editor changes
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        updateStatusBar(editor, workspacePath);
    }));
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('entropy.refresh', () => {
        runAnalysis(gitAnalyzer, workspacePath, false);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('entropy.openPanel', () => {
        vscode.commands.executeCommand('entropyTracker.sidebar.focus');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('entropy.clearCache', async () => {
        const confirm = await vscode.window.showWarningMessage('This will delete all cached entropy data and re-analyze. Continue?', { modal: true }, 'Yes, Clear & Re-analyze');
        if (confirm) {
            outputChannel.appendLine('[Entropy] Clearing cache and re-analyzing…');
            database.destroy();
            database = new database_1.EntropyDatabase(storagePath);
            await database.open();
            // Update references in providers
            decorationProvider = new decorationProvider_1.EntropyDecorationProvider(database, workspacePath);
            context.subscriptions.push(vscode.window.registerFileDecorationProvider(decorationProvider));
            await runAnalysis(gitAnalyzer, workspacePath, false);
        }
    }));
    // Set initial status bar state
    updateStatusBar(vscode.window.activeTextEditor, workspacePath);
    // Run initial analysis in background (don't block activation)
    outputChannel.appendLine('[Entropy] Starting background analysis…');
    runAnalysis(gitAnalyzer, workspacePath, true);
    outputChannel.appendLine('[Entropy] Extension activated successfully');
}
/**
 * Runs the full entropy analysis pipeline:
 * 1. Fetch git log data
 * 2. Score all files
 * 3. Store results in database
 * 4. Refresh all UI providers
 *
 * @param gitAnalyzer   The git analyzer instance
 * @param workspacePath Absolute path to the workspace root
 * @param incremental   Whether to only process new commits since last run
 */
async function runAnalysis(gitAnalyzer, workspacePath, incremental) {
    if (isAnalyzing) {
        outputChannel.appendLine('[Entropy] Analysis already in progress, skipping');
        return;
    }
    isAnalyzing = true;
    try {
        const config = vscode.workspace.getConfiguration('entropy');
        const lookbackDays = config.get('lookbackDays', 90);
        const minCommits = config.get('minCommitsToScore', 5);
        outputChannel.appendLine(`[Entropy] Running analysis (lookback: ${lookbackDays} days, min commits: ${minCommits}, incremental: ${incremental})`);
        // Show progress notification
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: 'Entropy Tracker',
            cancellable: true,
        }, async (progress, token) => {
            // Step 1: Git analysis
            progress.report({ message: 'Analyzing git history…' });
            const lastHash = incremental ? database.getLastCommitHash() : null;
            const fileDataMap = await gitAnalyzer.analyze(lookbackDays, lastHash, token);
            if (token.isCancellationRequested) {
                outputChannel.appendLine('[Entropy] Analysis cancelled by user');
                return;
            }
            if (fileDataMap.size === 0) {
                outputChannel.appendLine('[Entropy] No files to process');
                // Still refresh UI in case this is a fresh analysis with no results
                refreshAllUI(workspacePath);
                return;
            }
            // Step 2: Score all files
            progress.report({ message: `Scoring ${fileDataMap.size} files…` });
            const scoredFiles = (0, scorer_1.scoreAllFiles)(fileDataMap, minCommits);
            outputChannel.appendLine(`[Entropy] Scored ${scoredFiles.length} files (${fileDataMap.size - scoredFiles.length} below threshold)`);
            if (token.isCancellationRequested) {
                return;
            }
            // Step 3: Store results
            progress.report({ message: 'Saving results…' });
            const entries = scoredFiles.map((sf) => sf.data);
            database.upsertMany(entries);
            // Save the latest commit hash for incremental updates
            const latestHash = await gitAnalyzer.getLatestCommitHash();
            if (latestHash) {
                database.setLastCommitHash(latestHash);
            }
            // Step 4: Refresh UI
            progress.report({ message: 'Updating UI…' });
            refreshAllUI(workspacePath);
            // Log top 5 files for quick reference
            const top5 = scoredFiles.slice(0, 5);
            if (top5.length > 0) {
                outputChannel.appendLine('[Entropy] Top entropy files:');
                for (const file of top5) {
                    const badge = (0, scorer_1.getSeverityBadge)((0, scorer_1.getSeverity)(file.data.score));
                    outputChannel.appendLine(`  ${badge} ${file.data.score}/100 — ${file.data.path} (${file.data.topicCount} topics, ${file.data.authorCount} authors)`);
                }
            }
            outputChannel.appendLine('[Entropy] Analysis complete');
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`[Entropy] Analysis error: ${message}`);
        vscode.window.showErrorMessage(`Entropy Tracker: Analysis failed — ${message}`);
    }
    finally {
        isAnalyzing = false;
    }
}
/**
 * Refreshes all UI components after analysis completes.
 */
function refreshAllUI(workspacePath) {
    decorationProvider.refresh();
    sidebarProvider.refresh();
    updateStatusBar(vscode.window.activeTextEditor, workspacePath);
}
/**
 * Updates the status bar item with the entropy score of the
 * currently active file.
 */
function updateStatusBar(editor, workspacePath) {
    if (!editor || !database) {
        statusBarItem.hide();
        return;
    }
    // Get relative path
    const relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);
    // Skip if not in workspace
    if (relativePath === editor.document.uri.fsPath) {
        statusBarItem.hide();
        return;
    }
    // Normalize path separators
    const normalizedPath = relativePath.replace(/\\/g, '/');
    // Look up score
    const fileData = database.getScore(normalizedPath);
    if (!fileData) {
        statusBarItem.text = '$(beaker) —';
        statusBarItem.tooltip = 'Entropy: Not scored (too few commits or not tracked)';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.show();
        return;
    }
    const severity = (0, scorer_1.getSeverity)(fileData.score);
    const badge = (0, scorer_1.getSeverityBadge)(severity);
    statusBarItem.text = `$(beaker) ${badge} ${fileData.score}`;
    switch (severity) {
        case 'critical':
            statusBarItem.tooltip = `Entropy: ${fileData.score}/100 — CRITICAL\n${fileData.suggestion}`;
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            break;
        case 'warning':
            statusBarItem.tooltip = `Entropy: ${fileData.score}/100 — Warning\n${fileData.suggestion}`;
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            break;
        default:
            statusBarItem.tooltip = `Entropy: ${fileData.score}/100 — Healthy`;
            statusBarItem.backgroundColor = undefined;
            break;
    }
    statusBarItem.show();
}
/**
 * Extension deactivation hook.
 * Cleans up the database connection.
 */
function deactivate() {
    if (database) {
        database.close();
    }
    if (outputChannel) {
        outputChannel.appendLine('[Entropy] Extension deactivated');
    }
}
//# sourceMappingURL=extension.js.map