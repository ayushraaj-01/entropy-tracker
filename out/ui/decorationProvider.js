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
exports.EntropyDecorationProvider = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Provides file decorations in the VS Code Explorer based on entropy scores.
 *
 * Files are decorated with colored dots:
 *  - 🔴 Critical (score ≥ 70): red dot with "split this file" tooltip
 *  - 🟡 Warning  (score 40-69): amber dot with "watch this file" tooltip
 *  - Healthy (score < 40): no decoration
 */
class EntropyDecorationProvider {
    constructor(db, workspacePath) {
        this.db = db;
        this.workspacePath = workspacePath;
        this._onDidChangeFileDecorations = new vscode.EventEmitter();
        this.onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
    }
    /**
     * Provides decoration for a single file URI.
     * Only decorates files with entropy scores at warning or critical level.
     */
    provideFileDecoration(uri, _token) {
        // Check if decorations are enabled
        const config = vscode.workspace.getConfiguration('entropy');
        if (!config.get('showDecorationsInExplorer', true)) {
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
            return new vscode.FileDecoration('⬤', `Entropy: ${score}/100 — split this file`, new vscode.ThemeColor('errorForeground'));
        }
        if (score >= 40) {
            return new vscode.FileDecoration('⬤', `Entropy: ${score}/100 — watch this file`, new vscode.ThemeColor('problemsWarningIcon.foreground'));
        }
        // Healthy files get no decoration
        return undefined;
    }
    /**
     * Fires a change event to refresh all file decorations.
     * Call this after analysis completes to update the Explorer.
     */
    refresh() {
        this._onDidChangeFileDecorations.fire(undefined);
    }
    /**
     * Disposes of the event emitter.
     */
    dispose() {
        this._onDidChangeFileDecorations.dispose();
    }
}
exports.EntropyDecorationProvider = EntropyDecorationProvider;
//# sourceMappingURL=decorationProvider.js.map