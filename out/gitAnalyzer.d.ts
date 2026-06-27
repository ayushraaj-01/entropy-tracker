import * as vscode from 'vscode';
/**
 * Raw commit data for a single commit touching a specific file.
 */
export interface CommitInfo {
    hash: string;
    date: string;
    message: string;
    author: string;
    files: string[];
}
/**
 * Aggregated git analysis result for a single file.
 */
export interface FileGitData {
    filePath: string;
    editCount: number;
    commitMessages: string[];
    authors: string[];
    uniqueAuthors: string[];
    authorCount: number;
    coupledFiles: Map<string, number>;
    couplingScore: number;
}
/**
 * Analyzes git history for all files in the workspace.
 * Supports incremental updates by tracking the last processed commit.
 */
export declare class GitAnalyzer {
    private workspacePath;
    private git;
    private log;
    constructor(workspacePath: string, outputChannel: vscode.OutputChannel);
    /**
     * Checks if the workspace contains a valid git repository.
     */
    isGitRepo(): Promise<boolean>;
    /**
     * Gets the latest commit hash in the repository.
     */
    getLatestCommitHash(): Promise<string | null>;
    /**
     * Analyzes git history for the given lookback period.
     *
     * @param lookbackDays Number of days of history to analyze
     * @param sinceCommit  If provided, only analyze commits after this hash (incremental)
     * @param token        Cancellation token to abort long-running analysis
     * @returns Map of relative file paths to their aggregated git data
     */
    analyze(lookbackDays?: number, sinceCommit?: string | null, token?: vscode.CancellationToken): Promise<Map<string, FileGitData>>;
    /**
     * Runs raw git log command with a format that's easy to parse.
     * Uses a delimiter-based format to reliably extract commit data.
     */
    private getRawCommitLog;
    /**
     * Parses the raw git log output into structured CommitInfo objects.
     */
    private parseRawLog;
    /**
     * Computes a coupling score for a file.
     * Higher score = file is frequently changed with many other files.
     *
     * The score rewards breadth of coupling (many different files)
     * weighted by frequency (how often they change together).
     */
    private computeCouplingScore;
    /**
     * Determines if a file should be skipped during analysis.
     * Skips lock files, generated files, and binary formats.
     */
    private shouldSkipFile;
}
//# sourceMappingURL=gitAnalyzer.d.ts.map