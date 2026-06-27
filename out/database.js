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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntropyDatabase = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const sql_js_1 = __importDefault(require("sql.js"));
/**
 * Manages the SQLite database for caching entropy scores.
 * Uses sql.js (pure WASM, no native compilation required).
 * The DB file lives in the extension's globalStorageUri folder.
 */
class EntropyDatabase {
    constructor(storagePath) {
        this.db = null;
        this.initialized = false;
        this.initPromise = null;
        this.storagePath = storagePath;
        // Ensure the storage directory exists
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }
        this.dbPath = path.join(storagePath, 'entropy.db');
    }
    /**
     * Initializes sql.js and opens (or creates) the database.
     * This must be called before any other method.
     * Safe to call multiple times — subsequent calls are no-ops.
     */
    async open() {
        if (this.initialized && this.db) {
            return;
        }
        // Prevent concurrent initialization
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = this._doOpen();
        await this.initPromise;
        this.initPromise = null;
    }
    async _doOpen() {
        // Initialize sql.js WASM engine
        const SQL = await (0, sql_js_1.default)();
        // Load existing database from disk if it exists
        if (fs.existsSync(this.dbPath)) {
            try {
                const fileBuffer = fs.readFileSync(this.dbPath);
                this.db = new SQL.Database(fileBuffer);
            }
            catch {
                // If the file is corrupt, start fresh
                this.db = new SQL.Database();
            }
        }
        else {
            this.db = new SQL.Database();
        }
        // Create tables
        this.db.run(`
      CREATE TABLE IF NOT EXISTS file_entropy (
        path TEXT PRIMARY KEY,
        score INTEGER NOT NULL DEFAULT 0,
        edit_count INTEGER NOT NULL DEFAULT 0,
        topic_count INTEGER NOT NULL DEFAULT 0,
        author_count INTEGER NOT NULL DEFAULT 0,
        authors TEXT NOT NULL DEFAULT '[]',
        topics TEXT NOT NULL DEFAULT '[]',
        suggestion TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL DEFAULT 0
      );
    `);
        this.db.run(`
      CREATE TABLE IF NOT EXISTS score_history (
        path TEXT NOT NULL,
        week INTEGER NOT NULL,
        year INTEGER NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        recorded_at INTEGER NOT NULL,
        PRIMARY KEY (path, year, week)
      );
    `);
        this.db.run(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
        // Create indexes (IF NOT EXISTS is supported in recent SQLite)
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_file_entropy_score ON file_entropy(score DESC);`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_score_history_path ON score_history(path, year DESC, week DESC);`);
        this.initialized = true;
        // Persist immediately to ensure the file exists
        this.persist();
    }
    /**
     * Writes the in-memory database to disk.
     */
    persist() {
        if (!this.db) {
            return;
        }
        try {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(this.dbPath, buffer);
        }
        catch {
            // Silently ignore write errors (e.g., permission issues)
        }
    }
    /**
     * Upserts a file's entropy data. Also records a weekly snapshot
     * if one hasn't been recorded for the current week yet.
     */
    upsert(data) {
        this.ensureOpen();
        const now = Date.now();
        this.db.run(`
      INSERT INTO file_entropy (path, score, edit_count, topic_count, author_count, authors, topics, suggestion, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        score = excluded.score,
        edit_count = excluded.edit_count,
        topic_count = excluded.topic_count,
        author_count = excluded.author_count,
        authors = excluded.authors,
        topics = excluded.topics,
        suggestion = excluded.suggestion,
        updated_at = excluded.updated_at
    `, [
            data.path,
            data.score,
            data.editCount,
            data.topicCount,
            data.authorCount,
            JSON.stringify(data.authors),
            JSON.stringify(data.topics),
            data.suggestion,
            now,
        ]);
        // Record weekly snapshot
        const date = new Date(now);
        const week = getISOWeek(date);
        const year = date.getFullYear();
        this.db.run(`
      INSERT INTO score_history (path, week, year, score, recorded_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(path, year, week) DO UPDATE SET
        score = excluded.score,
        recorded_at = excluded.recorded_at
    `, [data.path, week, year, data.score, now]);
    }
    /**
     * Upserts multiple file entries and persists once at the end.
     */
    upsertMany(entries) {
        this.ensureOpen();
        this.db.run('BEGIN TRANSACTION');
        try {
            for (const item of entries) {
                this.upsert(item);
            }
            this.db.run('COMMIT');
        }
        catch (e) {
            this.db.run('ROLLBACK');
            throw e;
        }
        this.persist();
    }
    /**
     * Gets the entropy score for a single file path.
     * Returns null if the file is not in the database.
     */
    getScore(filePath) {
        this.ensureOpen();
        const stmt = this.db.prepare('SELECT * FROM file_entropy WHERE path = ?');
        stmt.bind([filePath]);
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return this.rowToData(row);
        }
        stmt.free();
        return null;
    }
    /**
     * Returns the top N files by entropy score (highest first).
     */
    getTopFiles(limit = 10) {
        this.ensureOpen();
        const results = [];
        const stmt = this.db.prepare('SELECT * FROM file_entropy ORDER BY score DESC LIMIT ?');
        stmt.bind([limit]);
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push(this.rowToData(row));
        }
        stmt.free();
        return results;
    }
    /**
     * Returns all scored files.
     */
    getAll() {
        this.ensureOpen();
        const results = [];
        const stmt = this.db.prepare('SELECT * FROM file_entropy ORDER BY score DESC');
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push(this.rowToData(row));
        }
        stmt.free();
        return results;
    }
    /**
     * Returns the last updated timestamp across all entries,
     * or 0 if the database is empty.
     */
    getLastUpdated() {
        this.ensureOpen();
        const stmt = this.db.prepare('SELECT MAX(updated_at) as max_updated FROM file_entropy');
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row.max_updated ?? 0;
        }
        stmt.free();
        return 0;
    }
    /**
     * Gets the last processed commit hash for incremental updates.
     */
    getLastCommitHash() {
        this.ensureOpen();
        const stmt = this.db.prepare("SELECT value FROM meta WHERE key = 'last_commit_hash'");
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row.value ?? null;
        }
        stmt.free();
        return null;
    }
    /**
     * Stores the last processed commit hash.
     */
    setLastCommitHash(hash) {
        this.ensureOpen();
        this.db.run(`
      INSERT INTO meta (key, value) VALUES ('last_commit_hash', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [hash]);
        this.persist();
    }
    /**
     * Retrieves the weekly score history for a file (last N weeks).
     */
    getScoreHistory(filePath, weeks = 12) {
        this.ensureOpen();
        const results = [];
        const stmt = this.db.prepare(`
      SELECT week, year, score, recorded_at
      FROM score_history
      WHERE path = ?
      ORDER BY year DESC, week DESC
      LIMIT ?
    `);
        stmt.bind([filePath, weeks]);
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push(row);
        }
        stmt.free();
        return results.reverse(); // oldest first for sparkline
    }
    /**
     * Drops all data and recreates empty tables.
     */
    clearAll() {
        this.ensureOpen();
        this.db.run('DELETE FROM file_entropy');
        this.db.run('DELETE FROM score_history');
        this.db.run('DELETE FROM meta');
        this.persist();
    }
    /**
     * Deletes the database file entirely.
     */
    destroy() {
        this.close();
        if (fs.existsSync(this.dbPath)) {
            fs.unlinkSync(this.dbPath);
        }
    }
    /**
     * Closes the database connection.
     */
    close() {
        if (this.db) {
            this.persist();
            this.db.close();
            this.db = null;
            this.initialized = false;
        }
    }
    /**
     * Converts a raw database row to a parsed FileEntropyData object.
     */
    rowToData(row) {
        let authors = [];
        let topics = [];
        try {
            authors = JSON.parse(String(row.authors));
        }
        catch {
            authors = [];
        }
        try {
            topics = JSON.parse(String(row.topics));
        }
        catch {
            topics = [];
        }
        return {
            path: String(row.path),
            score: Number(row.score),
            editCount: Number(row.edit_count),
            topicCount: Number(row.topic_count),
            authorCount: Number(row.author_count),
            authors,
            topics,
            suggestion: String(row.suggestion),
            updatedAt: Number(row.updated_at),
        };
    }
    /**
     * Ensures the database is initialized before any synchronous operation.
     * Throws if open() hasn't been awaited yet.
     */
    ensureOpen() {
        if (!this.db || !this.initialized) {
            throw new Error('EntropyDatabase: database not initialized. Call await db.open() first.');
        }
    }
}
exports.EntropyDatabase = EntropyDatabase;
/**
 * Returns the ISO week number for a given date.
 */
function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
//# sourceMappingURL=database.js.map