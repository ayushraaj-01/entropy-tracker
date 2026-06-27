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
exports.clusterCommitMessages = clusterCommitMessages;
const natural = __importStar(require("natural"));
/**
 * Known conventional commit prefixes and their human-readable labels.
 */
const CONVENTIONAL_PREFIXES = {
    'feat': 'Features',
    'fix': 'Bug Fixes',
    'refactor': 'Refactoring',
    'chore': 'Chores',
    'docs': 'Documentation',
    'style': 'Styling',
    'test': 'Tests',
    'perf': 'Performance',
    'ci': 'CI/CD',
    'build': 'Build',
    'revert': 'Reverts',
};
/**
 * Regex to detect conventional commit format.
 * Matches: type(scope): message  OR  type: message
 */
const CONVENTIONAL_REGEX = /^(feat|fix|refactor|chore|docs|style|test|perf|ci|build|revert)(\(.+?\))?[!]?:\s/i;
/**
 * Common stop words to filter from TF-IDF analysis.
 */
const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'it', 'its',
    'this', 'that', 'these', 'those', 'i', 'we', 'you', 'he', 'she',
    'they', 'me', 'us', 'him', 'her', 'them', 'my', 'our', 'your',
    'his', 'their', 'not', 'no', 'so', 'if', 'then', 'else',
    'when', 'while', 'as', 'up', 'out', 'into', 'some', 'all', 'any',
    'each', 'just', 'also', 'more', 'most', 'other', 'than',
    // Common commit message filler words
    'add', 'added', 'update', 'updated', 'change', 'changed', 'file',
    'files', 'code', 'remove', 'removed', 'use', 'using', 'make',
    'now', 'new', 'get', 'set',
]);
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
function clusterCommitMessages(messages) {
    if (!messages || messages.length === 0) {
        return { topicCount: 0, topicLabels: [], usedConventionalCommits: false };
    }
    if (messages.length === 1) {
        return { topicCount: 1, topicLabels: [summarizeMessage(messages[0])], usedConventionalCommits: false };
    }
    // Check for conventional commit format
    const conventionalResult = tryConventionalCommits(messages);
    if (conventionalResult) {
        return conventionalResult;
    }
    // Fall back to TF-IDF clustering
    return tfidfCluster(messages);
}
/**
 * Attempts to classify messages using Conventional Commits prefixes.
 * Returns a result if more than 50% of messages match the format.
 */
function tryConventionalCommits(messages) {
    const prefixCounts = new Map();
    let matchCount = 0;
    for (const msg of messages) {
        const match = msg.match(CONVENTIONAL_REGEX);
        if (match) {
            matchCount++;
            const prefix = match[1].toLowerCase();
            prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
        }
    }
    // Require at least 50% of messages to be conventional format
    const ratio = matchCount / messages.length;
    if (ratio < 0.5) {
        return null;
    }
    // Sort prefixes by frequency (most common first)
    const sortedPrefixes = [...prefixCounts.entries()]
        .sort((a, b) => b[1] - a[1]);
    const topicLabels = sortedPrefixes.map(([prefix, count]) => {
        const label = CONVENTIONAL_PREFIXES[prefix] || capitalize(prefix);
        return `${label} (${count})`;
    });
    return {
        topicCount: prefixCounts.size,
        topicLabels,
        usedConventionalCommits: true,
    };
}
/**
 * Clusters messages using TF-IDF vectorization and cosine similarity.
 * Uses a greedy agglomerative approach: each message is assigned to
 * the first cluster whose centroid has similarity > threshold, or
 * starts a new cluster.
 */
function tfidfCluster(messages) {
    const SIMILARITY_THRESHOLD = 0.4;
    // Clean and tokenize messages
    const cleanedMessages = messages.map(cleanMessage);
    // Build TF-IDF model
    const tfidf = new natural.TfIdf();
    for (const msg of cleanedMessages) {
        tfidf.addDocument(msg);
    }
    // Extract TF-IDF vectors for each document
    const vectors = [];
    for (let i = 0; i < cleanedMessages.length; i++) {
        const vector = new Map();
        tfidf.listTerms(i).forEach((item) => {
            vector.set(item.term, item.tfidf);
        });
        vectors.push(vector);
    }
    // Greedy clustering
    const clusters = []; // Each cluster is an array of message indices
    const clusterCentroids = [];
    for (let i = 0; i < vectors.length; i++) {
        const vec = vectors[i];
        let bestCluster = -1;
        let bestSimilarity = 0;
        // Compare against existing cluster centroids
        for (let c = 0; c < clusterCentroids.length; c++) {
            const sim = cosineSimilarity(vec, clusterCentroids[c]);
            if (sim > bestSimilarity) {
                bestSimilarity = sim;
                bestCluster = c;
            }
        }
        if (bestSimilarity >= SIMILARITY_THRESHOLD && bestCluster >= 0) {
            // Add to existing cluster and update centroid
            clusters[bestCluster].push(i);
            clusterCentroids[bestCluster] = computeCentroid(clusters[bestCluster].map((idx) => vectors[idx]));
        }
        else {
            // Start a new cluster
            clusters.push([i]);
            clusterCentroids.push(new Map(vec));
        }
    }
    // Generate labels for each cluster
    const topicLabels = clusters.map((clusterIndices) => {
        return generateClusterLabel(clusterIndices, cleanedMessages, tfidf);
    });
    // Sort by cluster size (largest first)
    const indexed = topicLabels.map((label, i) => ({ label, size: clusters[i].length }));
    indexed.sort((a, b) => b.size - a.size);
    return {
        topicCount: clusters.length,
        topicLabels: indexed.map((item) => `${item.label} (${item.size})`),
        usedConventionalCommits: false,
    };
}
/**
 * Computes cosine similarity between two TF-IDF vectors.
 */
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    // Compute dot product using the smaller vector
    for (const [term, weightA] of vecA) {
        const weightB = vecB.get(term);
        if (weightB !== undefined) {
            dotProduct += weightA * weightB;
        }
        normA += weightA * weightA;
    }
    for (const [, weight] of vecB) {
        normB += weight * weight;
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
        return 0;
    }
    return dotProduct / denominator;
}
/**
 * Computes the centroid (average) of multiple TF-IDF vectors.
 */
function computeCentroid(vectors) {
    const centroid = new Map();
    for (const vec of vectors) {
        for (const [term, weight] of vec) {
            centroid.set(term, (centroid.get(term) || 0) + weight);
        }
    }
    // Average
    const count = vectors.length;
    for (const [term, weight] of centroid) {
        centroid.set(term, weight / count);
    }
    return centroid;
}
/**
 * Generates a human-readable label for a cluster based on
 * the most important TF-IDF terms across its messages.
 */
function generateClusterLabel(indices, messages, tfidf) {
    // Collect all terms and their TF-IDF scores across the cluster
    const termScores = new Map();
    for (const idx of indices) {
        tfidf.listTerms(idx).forEach((item) => {
            if (!STOP_WORDS.has(item.term.toLowerCase()) && item.term.length > 2) {
                termScores.set(item.term, (termScores.get(item.term) || 0) + item.tfidf);
            }
        });
    }
    // Get top 2-3 terms as the label
    const sortedTerms = [...termScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([term]) => capitalize(term));
    if (sortedTerms.length === 0) {
        // Fallback: use the first message as label
        const firstMsg = messages[indices[0]];
        return summarizeMessage(firstMsg);
    }
    return sortedTerms.join(', ');
}
/**
 * Cleans a commit message for TF-IDF processing.
 * Removes conventional commit prefixes, special characters,
 * issue numbers, and stop words.
 */
function cleanMessage(message) {
    let cleaned = message;
    // Remove conventional commit prefix if present
    cleaned = cleaned.replace(CONVENTIONAL_REGEX, '');
    // Remove issue/PR references like #123, GH-456
    cleaned = cleaned.replace(/#\d+/g, '');
    cleaned = cleaned.replace(/GH-\d+/gi, '');
    // Remove special characters but keep spaces
    cleaned = cleaned.replace(/[^a-zA-Z0-9\s]/g, ' ');
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    // Convert to lowercase
    cleaned = cleaned.toLowerCase();
    // Remove stop words
    const words = cleaned.split(' ').filter((w) => !STOP_WORDS.has(w) && w.length > 1);
    return words.join(' ');
}
/**
 * Creates a short summary from a commit message (first 30 chars).
 */
function summarizeMessage(message) {
    const cleaned = message.replace(CONVENTIONAL_REGEX, '').trim();
    if (cleaned.length <= 30) {
        return capitalize(cleaned);
    }
    return capitalize(cleaned.substring(0, 27)) + '...';
}
/**
 * Capitalizes the first letter of a string.
 */
function capitalize(str) {
    if (!str) {
        return str;
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
}
//# sourceMappingURL=topicCluster.js.map