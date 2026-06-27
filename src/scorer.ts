import { FileGitData } from './gitAnalyzer';
import { clusterCommitMessages, ClusterResult } from './topicCluster';
import { FileEntropyData } from './database';
import * as path from 'path';

/**
 * Entropy severity levels with their associated thresholds.
 */
export enum EntropySeverity {
  Healthy = 'healthy',
  Warning = 'warning',
  Critical = 'critical',
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
export function getSeverity(score: number): EntropySeverity {
  if (score >= 70) { return EntropySeverity.Critical; }
  if (score >= 40) { return EntropySeverity.Warning; }
  return EntropySeverity.Healthy;
}

/**
 * Returns the appropriate emoji badge for a severity level.
 */
export function getSeverityBadge(severity: EntropySeverity): string {
  switch (severity) {
    case EntropySeverity.Critical: return '🔴';
    case EntropySeverity.Warning: return '🟡';
    case EntropySeverity.Healthy: return '🟢';
  }
}

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
export function scoreFile(
  fileData: FileGitData,
  minCommits: number = 5
): ScoredFile | null {
  // Don't score files with insufficient commit history
  if (fileData.editCount < minCommits) {
    return null;
  }

  // Cluster commit messages to determine topic count
  const clusterResult = clusterCommitMessages(fileData.commitMessages);

  // Compute raw entropy score
  const raw =
    (fileData.editCount * 0.3) +
    (clusterResult.topicCount * 25) +
    (fileData.authorCount * 15) +
    (fileData.couplingScore * 0.3);

  const score = Math.min(100, Math.round(raw));
  const severity = getSeverity(score);

  // Generate human-readable suggestion
  const suggestion = generateSuggestion(
    fileData.filePath,
    score,
    severity,
    clusterResult,
    fileData
  );

  const data: FileEntropyData = {
    path: fileData.filePath,
    score,
    editCount: fileData.editCount,
    topicCount: clusterResult.topicCount,
    authorCount: fileData.authorCount,
    authors: fileData.uniqueAuthors,
    topics: clusterResult.topicLabels,
    suggestion,
    updatedAt: Date.now(),
  };

  return { data, severity, clusterResult };
}

/**
 * Scores all files from a git analysis run.
 *
 * @param fileDataMap Map of file paths to their git analysis data
 * @param minCommits  Minimum commits required to produce a score
 * @returns Array of scored files (only those meeting the threshold)
 */
export function scoreAllFiles(
  fileDataMap: Map<string, FileGitData>,
  minCommits: number = 5
): ScoredFile[] {
  const results: ScoredFile[] = [];

  for (const [, fileData] of fileDataMap) {
    const scored = scoreFile(fileData, minCommits);
    if (scored) {
      results.push(scored);
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.data.score - a.data.score);

  return results;
}

/**
 * Generates a human-readable suggestion based on the file's entropy profile.
 *
 * The suggestion adapts based on which factors contribute most to the score:
 * - High topic count → recommend splitting by concern
 * - High author count → recommend ownership clarification
 * - High coupling → recommend decoupling
 * - Combination → compound suggestion
 */
function generateSuggestion(
  filePath: string,
  score: number,
  severity: EntropySeverity,
  clusterResult: ClusterResult,
  gitData: FileGitData
): string {
  const fileName = path.basename(filePath, path.extname(filePath));
  const friendlyName = toPascalCase(fileName);

  if (severity === EntropySeverity.Healthy) {
    return `${friendlyName} looks healthy. Keep it focused on its current responsibilities.`;
  }

  const suggestions: string[] = [];

  // Topic-based suggestions
  if (clusterResult.topicCount >= 5) {
    const topTopics = clusterResult.topicLabels
      .slice(0, 3)
      .map((t) => t.replace(/\s*\(\d+\)$/, ''));

    suggestions.push(
      `This file handles ${clusterResult.topicCount} unrelated concerns` +
      (topTopics.length > 0 ? ` including ${topTopics.join(', ')}` : '') +
      `. Consider splitting into separate modules.`
    );
  } else if (clusterResult.topicCount >= 3) {
    suggestions.push(
      `This file is modified for ${clusterResult.topicCount} different reasons. ` +
      `Review if some responsibilities can be extracted.`
    );
  }

  // Author-based suggestions
  if (gitData.authorCount >= 5) {
    suggestions.push(
      `${gitData.authorCount} different authors have modified this file. ` +
      `Consider clarifying ownership or adding stricter code review.`
    );
  }

  // Coupling-based suggestions
  if (gitData.couplingScore >= 15) {
    const topCoupled = [...gitData.coupledFiles.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([file]) => path.basename(file));

    suggestions.push(
      `This file is tightly coupled with ${topCoupled.join(' and ')}. ` +
      `Consider introducing an abstraction layer to reduce dependencies.`
    );
  }

  // Edit frequency suggestions
  if (gitData.editCount >= 30 && suggestions.length === 0) {
    suggestions.push(
      `This file has been edited ${gitData.editCount} times recently. ` +
      `High change frequency can indicate it's doing too much.`
    );
  }

  // Fallback suggestion
  if (suggestions.length === 0) {
    if (severity === EntropySeverity.Critical) {
      suggestions.push(
        `${friendlyName} has high entropy (${score}/100). ` +
        `Review its responsibilities and consider refactoring.`
      );
    } else {
      suggestions.push(
        `${friendlyName} is showing moderate entropy (${score}/100). ` +
        `Keep an eye on its growth.`
      );
    }
  }

  return suggestions.join(' ');
}

/**
 * Converts a filename (kebab-case or snake_case) to PascalCase.
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_.]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
