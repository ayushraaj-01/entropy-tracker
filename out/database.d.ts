/**
 * Represents a single file's entropy data stored in the database.
 */
export interface FileEntropyRow {
    path: string;
    score: number;
    edit_count: number;
    topic_count: number;
    author_count: number;
    authors: string;
    topics: string;
    suggestion: string;
    updated_at: number;
}
/**
 * Parsed version of FileEntropyRow with deserialized JSON fields.
 */
export interface FileEntropyData {
    path: string;
    score: number;
    editCount: number;
    topicCount: number;
    authorCount: number;
    authors: string[];
    topics: string[];
    suggestion: string;
    updatedAt: number;
}
/**
 * Weekly score snapshot for sparkline rendering.
 */
export interface WeeklyScore {
    week: number;
    year: number;
    score: number;
    recorded_at: number;
}
/**
 * Manages the SQLite database for caching entropy scores.
 * Uses sql.js (pure WASM, no native compilation required).
 * The DB file lives in the extension's globalStorageUri folder.
 */
export declare class EntropyDatabase {
    private db;
    private dbPath;
    private storagePath;
    private initialized;
    private initPromise;
    constructor(storagePath: string);
    /**
     * Initializes sql.js and opens (or creates) the database.
     * This must be called before any other method.
     * Safe to call multiple times — subsequent calls are no-ops.
     */
    open(): Promise<void>;
    private _doOpen;
    /**
     * Writes the in-memory database to disk.
     */
    private persist;
    /**
     * Upserts a file's entropy data. Also records a weekly snapshot
     * if one hasn't been recorded for the current week yet.
     */
    upsert(data: FileEntropyData): void;
    /**
     * Upserts multiple file entries and persists once at the end.
     */
    upsertMany(entries: FileEntropyData[]): void;
    /**
     * Gets the entropy score for a single file path.
     * Returns null if the file is not in the database.
     */
    getScore(filePath: string): FileEntropyData | null;
    /**
     * Returns the top N files by entropy score (highest first).
     */
    getTopFiles(limit?: number): FileEntropyData[];
    /**
     * Returns all scored files.
     */
    getAll(): FileEntropyData[];
    /**
     * Returns the last updated timestamp across all entries,
     * or 0 if the database is empty.
     */
    getLastUpdated(): number;
    /**
     * Gets the last processed commit hash for incremental updates.
     */
    getLastCommitHash(): string | null;
    /**
     * Stores the last processed commit hash.
     */
    setLastCommitHash(hash: string): void;
    /**
     * Retrieves the weekly score history for a file (last N weeks).
     */
    getScoreHistory(filePath: string, weeks?: number): WeeklyScore[];
    /**
     * Drops all data and recreates empty tables.
     */
    clearAll(): void;
    /**
     * Deletes the database file entirely.
     */
    destroy(): void;
    /**
     * Closes the database connection.
     */
    close(): void;
    /**
     * Converts a raw database row to a parsed FileEntropyData object.
     */
    private rowToData;
    /**
     * Ensures the database is initialized before any synchronous operation.
     * Throws if open() hasn't been awaited yet.
     */
    private ensureOpen;
}
//# sourceMappingURL=database.d.ts.map