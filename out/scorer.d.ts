import { FileGitData } from './gitAnalyzer';
import { ClusterResult } from './topicCluster';
import { FileEntropyData } from './database';
/**
 * Entropy severity levels with their associated thresholds.
 */
export declare enum EntropySeverity {
    Healthy = "healthy",
    Warning = "warning",
    Critical = "critical"
}
/**
 * Result of scoring a single file's entropy.
 */
export interface ScoredFile {
    data: FileEntropyData;
    severity: EntropySeverity;
    clusterResult: ClusterResult;
}
/**
 * Returns the severity level for a given score.
 */
export declare function getSeverity(score: number): EntropySeverity;
/**
 * Returns the appropriate emoji badge for a severity level.
 */
export declare function getSeverityBadge(severity: EntropySeverity): string;
/**
 * Scores a single file's entropy based on git analysis data.
 *
 * Formula:
 *   raw = (edit_count * 0.3) + (topic_count * 25) + (author_count * 15) + (coupling_score * 0.3)
 *   score = min(100, round(raw))
 *
 * @param fileData      Aggregated git data for the file
 * @param minCommits    Minimum commits required to produce a score
 * @returns ScoredFile or null if the file doesn't meet the minimum commits threshold
 */
export declare function scoreFile(fileData: FileGitData, minCommits?: number): ScoredFile | null;
/**
 * Scores all files from a git analysis run.
 *
 * @param fileDataMap Map of file paths to their git analysis data
 * @param minCommits  Minimum commits required to produce a score
 * @returns Array of scored files (only those meeting the threshold)
 */
export declare function scoreAllFiles(fileDataMap: Map<string, FileGitData>, minCommits?: number): ScoredFile[];
//# sourceMappingURL=scorer.d.ts.map