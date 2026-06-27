import simpleGit, { SimpleGit, LogResult, DefaultLogFields } from 'simple-git';
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
  coupledFiles: Map<string, number>;  // file -> co-change count
  couplingScore: number;
}

/**
 * Analyzes git history for all files in the workspace.
 * Supports incremental updates by tracking the last processed commit.
 */
export class GitAnalyzer {
  private git: SimpleGit;
  private log: vscode.OutputChannel;

  constructor(
    private workspacePath: string,
    outputChannel: vscode.OutputChannel
  ) {
    this.git = simpleGit(workspacePath);
    this.log = outputChannel;
  }

  /**
   * Checks if the workspace contains a valid git repository.
   */
  public async isGitRepo(): Promise<boolean> {
    try {
      await this.git.revparse(['--is-inside-work-tree']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets the latest commit hash in the repository.
   */
  public async getLatestCommitHash(): Promise<string | null> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      return log.latest?.hash ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Analyzes git history for the given lookback period.
   *
   * @param lookbackDays Number of days of history to analyze
   * @param sinceCommit  If provided, only analyze commits after this hash (incremental)
   * @param token        Cancellation token to abort long-running analysis
   * @returns Map of relative file paths to their aggregated git data
   */
  public async analyze(
    lookbackDays: number = 90,
    sinceCommit?: string | null,
    token?: vscode.CancellationToken
  ): Promise<Map<string, FileGitData>> {
    const fileDataMap = new Map<string, FileGitData>();

    try {
      // Build git log arguments
      const since = new Date();
      since.setDate(since.getDate() - lookbackDays);
      const sinceStr = since.toISOString().split('T')[0];

      this.log.appendLine(`[GitAnalyzer] Analyzing commits since ${sinceStr}`);

      // Fetch git log with file stats
      let logResult: LogResult<DefaultLogFields>;

      const logOptions: Record<string, unknown> = {
        '--stat': null,
        '--stat-width': '1000',
        '--name-only': null,
        '--after': sinceStr,
      };

      if (sinceCommit) {
        logOptions['--ancestry-path'] = null;
        // Fetch commits after the last processed one
        try {
          // Verify the commit still exists
          await this.git.revparse([sinceCommit]);
          this.log.appendLine(`[GitAnalyzer] Incremental update from ${sinceCommit.substring(0, 8)}`);
        } catch {
          // If the commit doesn't exist anymore, do a full scan
          this.log.appendLine(`[GitAnalyzer] Last commit ${sinceCommit?.substring(0, 8)} not found, doing full scan`);
          sinceCommit = undefined;
        }
      }

      // Use raw git log for reliable file path extraction
      const rawLog = await this.getRawCommitLog(sinceStr, sinceCommit);

      if (token?.isCancellationRequested) {
        this.log.appendLine('[GitAnalyzer] Analysis cancelled');
        return fileDataMap;
      }

      // Parse the raw log into commit objects
      const commits = this.parseRawLog(rawLog);
      this.log.appendLine(`[GitAnalyzer] Found ${commits.length} commits to process`);

      if (commits.length === 0) {
        return fileDataMap;
      }

      // Process each commit
      for (const commit of commits) {
        if (token?.isCancellationRequested) {
          this.log.appendLine('[GitAnalyzer] Analysis cancelled during processing');
          return fileDataMap;
        }

        for (const file of commit.files) {
          // Skip binary files and common non-source files
          if (this.shouldSkipFile(file)) {
            continue;
          }

          let fileData = fileDataMap.get(file);
          if (!fileData) {
            fileData = {
              filePath: file,
              editCount: 0,
              commitMessages: [],
              authors: [],
              uniqueAuthors: [],
              authorCount: 0,
              coupledFiles: new Map(),
              couplingScore: 0,
            };
            fileDataMap.set(file, fileData);
          }

          fileData.editCount++;
          fileData.commitMessages.push(commit.message);
          fileData.authors.push(commit.author);

          // Track co-changed files (coupling)
          for (const otherFile of commit.files) {
            if (otherFile !== file && !this.shouldSkipFile(otherFile)) {
              const current = fileData.coupledFiles.get(otherFile) || 0;
              fileData.coupledFiles.set(otherFile, current + 1);
            }
          }
        }
      }

      // Post-process: compute unique authors and coupling scores
      for (const [, fileData] of fileDataMap) {
        fileData.uniqueAuthors = [...new Set(fileData.authors)];
        fileData.authorCount = fileData.uniqueAuthors.length;
        fileData.couplingScore = this.computeCouplingScore(fileData);
      }

      this.log.appendLine(`[GitAnalyzer] Analysis complete: ${fileDataMap.size} files processed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.appendLine(`[GitAnalyzer] Error during analysis: ${message}`);
    }

    return fileDataMap;
  }

  /**
   * Runs raw git log command with a format that's easy to parse.
   * Uses a delimiter-based format to reliably extract commit data.
   */
  private async getRawCommitLog(since: string, afterCommit?: string | null): Promise<string> {
    const DELIM = '---ENTROPY_COMMIT_DELIM---';
    const FORMAT = `${DELIM}%n%H%n%an%n%aI%n%s`;

    const args = [
      'log',
      `--format=${FORMAT}`,
      '--name-only',
      `--after=${since}`,
    ];

    if (afterCommit) {
      args.push(`${afterCommit}..HEAD`);
    }

    try {
      const result = await this.git.raw(args);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.appendLine(`[GitAnalyzer] Raw log error: ${message}`);
      return '';
    }
  }

  /**
   * Parses the raw git log output into structured CommitInfo objects.
   */
  private parseRawLog(raw: string): CommitInfo[] {
    const DELIM = '---ENTROPY_COMMIT_DELIM---';
    const commits: CommitInfo[] = [];

    if (!raw || raw.trim().length === 0) {
      return commits;
    }

    const blocks = raw.split(DELIM).filter((b) => b.trim().length > 0);

    for (const block of blocks) {
      const lines = block.trim().split('\n').filter((l) => l.length > 0);

      if (lines.length < 4) {
        continue;
      }

      const hash = lines[0].trim();
      const author = lines[1].trim();
      const date = lines[2].trim();
      const message = lines[3].trim();

      // Lines 4+ are the file paths
      const files: string[] = [];
      for (let i = 4; i < lines.length; i++) {
        const fileLine = lines[i].trim();
        if (fileLine.length > 0) {
          // Normalize path separators to forward slashes
          files.push(fileLine.replace(/\\/g, '/'));
        }
      }

      commits.push({ hash, date, message, author, files });
    }

    return commits;
  }

  /**
   * Computes a coupling score for a file.
   * Higher score = file is frequently changed with many other files.
   *
   * The score rewards breadth of coupling (many different files)
   * weighted by frequency (how often they change together).
   */
  private computeCouplingScore(fileData: FileGitData): number {
    if (fileData.coupledFiles.size === 0) {
      return 0;
    }

    // Count how many unique files this file is coupled with
    const uniqueCoupledCount = fileData.coupledFiles.size;

    // Average coupling frequency
    let totalCoupling = 0;
    for (const [, count] of fileData.coupledFiles) {
      totalCoupling += count;
    }
    const avgCoupling = totalCoupling / uniqueCoupledCount;

    // Score: more coupled files and higher average = higher score
    // Cap individual components to prevent runaway scores
    const breadthScore = Math.min(uniqueCoupledCount, 30);
    const frequencyBonus = Math.min(avgCoupling, 10);

    return Math.round(breadthScore * (1 + frequencyBonus * 0.1));
  }

  /**
   * Determines if a file should be skipped during analysis.
   * Skips lock files, generated files, and binary formats.
   */
  private shouldSkipFile(filePath: string): boolean {
    const skipPatterns = [
      /package-lock\.json$/,
      /yarn\.lock$/,
      /pnpm-lock\.yaml$/,
      /\.lock$/,
      /\.min\.js$/,
      /\.min\.css$/,
      /\.map$/,
      /\.d\.ts$/,
      /dist\//,
      /build\//,
      /node_modules\//,
      /\.git\//,
      /\.png$/,
      /\.jpg$/,
      /\.jpeg$/,
      /\.gif$/,
      /\.ico$/,
      /\.svg$/,
      /\.woff2?$/,
      /\.ttf$/,
      /\.eot$/,
      /\.mp[34]$/,
      /\.wav$/,
      /\.pdf$/,
      /\.zip$/,
      /\.tar$/,
      /\.gz$/,
    ];

    return skipPatterns.some((pattern) => pattern.test(filePath));
  }
}
