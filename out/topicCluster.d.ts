/**
 * Result of clustering commit messages into distinct topics.
 */
export interface ClusterResult {
    /** Number of distinct topic clusters */
    topicCount: number;
    /** Human-readable labels for each cluster */
    topicLabels: string[];
    /** Whether conventional commit format was detected */
    usedConventionalCommits: boolean;
}
/**
 * Clusters commit messages for a file into distinct topics.
 *
 * Strategy:
 * 1. First check if messages use Conventional Commits format.
 *    If >50% of messages match, use prefix counting for simplicity.
 * 2. Otherwise, use TF-IDF + cosine similarity to group similar
 *    messages into clusters.
 *
 * @param messages Array of commit message strings for a single file
 * @returns ClusterResult with topic count and labels
 */
export declare function clusterCommitMessages(messages: string[]): ClusterResult;
//# sourceMappingURL=topicCluster.d.ts.map