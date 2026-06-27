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
exports.EntropyHoverProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const scorer_1 = require("../scorer");
/**
 * Regex patterns to detect import/require statements across languages.
 */
const IMPORT_PATTERNS = [
    // ES6 import: import X from 'path' | import 'path'
    /(?:import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"])/,
    // CommonJS require: require('path')
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/,
    // Dynamic import: import('path')
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/,
    // Python import: from X import Y | import X
    /(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/,
    // Go import: "path"
    /^\s*"([^"]+)"\s*$/,
    // Rust use: use crate::path
    /use\s+([\w:]+)/,
];
/**
 * File extension to language mapping for import resolution.
 */
const RESOLVABLE_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.go', '.rs', '.java', '.kt', '.swift',
    '.rb', '.php', '.vue', '.svelte',
];
/**
 * Provides hover information for imported files showing their entropy score.
 *
 * When hovering over an import/require statement, resolves the imported
 * file and displays its entropy metrics as a rich Markdown hover card.
 */
class EntropyHoverProvider {
    constructor(db, workspacePath) {
        this.db = db;
        this.workspacePath = workspacePath;
    }
    /**
     * Provides hover content for import statements.
     */
    provideHover(document, position, _token) {
        const line = document.lineAt(position.line).text;
        // Try to match the line against known import patterns
        const importPath = this.extractImportPath(line);
        if (!importPath) {
            return null;
        }
        // Check if cursor is actually on the import statement
        const lineRange = new vscode.Range(position.line, 0, position.line, line.length);
        // Resolve the import path to a workspace-relative file path
        const resolvedPath = this.resolveImportPath(importPath, document.uri.fsPath);
        if (!resolvedPath) {
            return null;
        }
        // Look up entropy data
        const fileData = this.db.getScore(resolvedPath);
        if (!fileData) {
            return null;
        }
        // Build the hover content
        const markdown = this.buildHoverMarkdown(fileData.path, fileData.score, fileData.editCount, fileData.topicCount, fileData.authorCount, fileData.topics, fileData.suggestion);
        return new vscode.Hover(markdown, lineRange);
    }
    /**
     * Extracts the import path from a line of code.
     */
    extractImportPath(line) {
        for (const pattern of IMPORT_PATTERNS) {
            const match = line.match(pattern);
            if (match) {
                // Return the first captured group that has a value
                for (let i = 1; i < match.length; i++) {
                    if (match[i]) {
                        return match[i];
                    }
                }
            }
        }
        return null;
    }
    /**
     * Resolves an import path to a workspace-relative file path.
     *
     * Handles:
     * - Relative imports (./foo, ../bar)
     * - Tries common file extensions if not specified
     * - Tries index files for directory imports
     */
    resolveImportPath(importPath, currentFilePath) {
        // Skip node_modules / package imports
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            return null;
        }
        const currentDir = path.dirname(currentFilePath);
        const absoluteBase = path.resolve(currentDir, importPath);
        // Try exact path first
        let resolved = this.tryResolve(absoluteBase);
        if (resolved) {
            return resolved;
        }
        // Try with common extensions
        for (const ext of RESOLVABLE_EXTENSIONS) {
            resolved = this.tryResolve(absoluteBase + ext);
            if (resolved) {
                return resolved;
            }
        }
        // Try as directory with index file
        for (const ext of RESOLVABLE_EXTENSIONS) {
            resolved = this.tryResolve(path.join(absoluteBase, 'index' + ext));
            if (resolved) {
                return resolved;
            }
        }
        return null;
    }
    /**
     * Checks if a file exists in the database and returns its
     * workspace-relative path, or null.
     */
    tryResolve(absolutePath) {
        // Convert to relative path from workspace root
        const relative = path.relative(this.workspacePath, absolutePath)
            .replace(/\\/g, '/');
        // Check if this file has entropy data
        const data = this.db.getScore(relative);
        if (data) {
            return relative;
        }
        return null;
    }
    /**
     * Builds a rich Markdown hover card for a file's entropy data.
     */
    buildHoverMarkdown(filePath, score, editCount, topicCount, authorCount, topics, suggestion) {
        const severity = (0, scorer_1.getSeverity)(score);
        const badge = (0, scorer_1.getSeverityBadge)(severity);
        const fileName = path.basename(filePath);
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportThemeIcons = true;
        // Header with badge and score
        md.appendMarkdown(`### ${badge} Entropy: ${score}/100\n\n`);
        md.appendMarkdown(`**${fileName}**\n\n`);
        // Metrics table
        md.appendMarkdown(`| Metric | Value |\n`);
        md.appendMarkdown(`|--------|-------|\n`);
        md.appendMarkdown(`| $(edit) Edits | ${editCount} |\n`);
        md.appendMarkdown(`| $(tag) Topics | ${topicCount} |\n`);
        md.appendMarkdown(`| $(person) Authors | ${authorCount} |\n`);
        // Top topics
        if (topics.length > 0) {
            md.appendMarkdown(`\n**Top Topics:**\n`);
            const topTopics = topics.slice(0, 3);
            for (const topic of topTopics) {
                md.appendMarkdown(`- ${topic}\n`);
            }
        }
        // Severity-specific styling
        if (severity === scorer_1.EntropySeverity.Critical) {
            md.appendMarkdown(`\n---\n`);
            md.appendMarkdown(`⚠️ **${suggestion}**\n`);
        }
        else if (severity === scorer_1.EntropySeverity.Warning) {
            md.appendMarkdown(`\n---\n`);
            md.appendMarkdown(`💡 ${suggestion}\n`);
        }
        return md;
    }
}
exports.EntropyHoverProvider = EntropyHoverProvider;
//# sourceMappingURL=hoverProvider.js.map