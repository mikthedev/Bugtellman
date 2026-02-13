/**
 * IndexedDB-based Data Persistence Service
 * 
 * Provides robust, consistent data persistence with:
 * - Transaction-based operations
 * - Error recovery
 * - Data integrity validation
 * - Schema versioning and migrations
 * - Concurrent access handling
 */

import type {
  PersistedAnalysis,
  PersistenceMetadata,
  PersistenceConfig,
  PersistenceError,
  PersistenceStats,
} from './types';

const DEFAULT_CONFIG: PersistenceConfig = {
  dbName: 'bugtellman-db',
  dbVersion: 1,
  storeName: 'analyses',
  maxEntries: 100,
  enableCompression: false,
  enableEncryption: false,
};

export class IndexedDBPersistenceService {
  private config: PersistenceConfig;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private stats: PersistenceStats = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageOperationTime: 0,
    lastOperationTime: 0,
    errors: [],
  };

  constructor(config?: Partial<PersistenceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not available'));
        return;
      }

      const request = indexedDB.open(this.config.dbName!, this.config.dbVersion!);

      request.onerror = () => {
        const error: PersistenceError = {
          code: 'INIT_FAILED',
          message: `Failed to open database: ${request.error?.message || 'Unknown error'}`,
          details: request.error,
        };
        this.recordError(error);
        reject(error);
        this.initPromise = null;
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.config.storeName!)) {
          const store = db.createObjectStore(this.config.storeName!, { keyPath: 'id' });
          store.createIndex('url', 'url', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('version', 'version', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Save an analysis result
   */
  async saveAnalysis(analysis: PersistedAnalysis): Promise<void> {
    await this.initialize();
    return this.executeOperation('write', async () => {
      if (!this.db) throw new Error('Database not initialized');

      // Validate data integrity
      this.validateAnalysis(analysis);

      // Enforce max entries limit
      await this.enforceMaxEntries();

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([this.config.storeName!], 'readwrite');
        const store = transaction.objectStore(this.config.storeName!);
        const request = store.put(analysis);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          const error: PersistenceError = {
            code: 'SAVE_FAILED',
            message: `Failed to save analysis: ${request.error?.message || 'Unknown error'}`,
            details: request.error,
          };
          this.recordError(error);
          reject(error);
        };
      });
    });
  }

  /**
   * Retrieve an analysis by ID
   */
  async getAnalysis(id: string): Promise<PersistedAnalysis | null> {
    await this.initialize();
    return this.executeOperation('read', async () => {
      if (!this.db) throw new Error('Database not initialized');

      return new Promise<PersistedAnalysis | null>((resolve, reject) => {
        const transaction = this.db!.transaction([this.config.storeName!], 'readonly');
        const store = transaction.objectStore(this.config.storeName!);
        const request = store.get(id);

        request.onsuccess = () => {
          const result = request.result as PersistedAnalysis | undefined;
          if (result) {
            // Validate retrieved data
            this.validateAnalysis(result);
            // Migrate if needed
            resolve(this.migrateIfNeeded(result));
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          const error: PersistenceError = {
            code: 'READ_FAILED',
            message: `Failed to read analysis: ${request.error?.message || 'Unknown error'}`,
            details: request.error,
          };
          this.recordError(error);
          reject(error);
        };
      });
    });
  }

  /**
   * Retrieve analysis by URL (most recent)
   */
  async getAnalysisByUrl(url: string): Promise<PersistedAnalysis | null> {
    await this.initialize();
    return this.executeOperation('read', async () => {
      if (!this.db) throw new Error('Database not initialized');

      return new Promise<PersistedAnalysis | null>((resolve, reject) => {
        const transaction = this.db!.transaction([this.config.storeName!], 'readonly');
        const store = transaction.objectStore(this.config.storeName!);
        const index = store.index('url');
        const request = index.getAll(url);

        request.onsuccess = () => {
          const results = request.result as PersistedAnalysis[];
          if (results.length === 0) {
            resolve(null);
            return;
          }

          // Return most recent
          const sorted = results.sort((a, b) => b.timestamp - a.timestamp);
          const mostRecent = sorted[0];
          this.validateAnalysis(mostRecent);
          resolve(this.migrateIfNeeded(mostRecent));
        };

        request.onerror = () => {
          const error: PersistenceError = {
            code: 'READ_FAILED',
            message: `Failed to read analysis by URL: ${request.error?.message || 'Unknown error'}`,
            details: request.error,
          };
          this.recordError(error);
          reject(error);
        };
      });
    });
  }

  /**
   * Get all analyses (sorted by timestamp, newest first)
   */
  async getAllAnalyses(): Promise<PersistedAnalysis[]> {
    await this.initialize();
    return this.executeOperation('read', async () => {
      if (!this.db) throw new Error('Database not initialized');

      return new Promise<PersistedAnalysis[]>((resolve, reject) => {
        const transaction = this.db!.transaction([this.config.storeName!], 'readonly');
        const store = transaction.objectStore(this.config.storeName!);
        const index = store.index('timestamp');
        const request = index.getAll();

        request.onsuccess = () => {
          const results = request.result as PersistedAnalysis[];
          // Validate and migrate all results
          const validated = results
            .map((r) => {
              try {
                this.validateAnalysis(r);
                return this.migrateIfNeeded(r);
              } catch (e) {
                console.warn('Skipping invalid analysis:', r.id, e);
                return null;
              }
            })
            .filter((r): r is PersistedAnalysis => r !== null)
            .sort((a, b) => b.timestamp - a.timestamp);

          resolve(validated);
        };

        request.onerror = () => {
          const error: PersistenceError = {
            code: 'READ_FAILED',
            message: `Failed to read all analyses: ${request.error?.message || 'Unknown error'}`,
            details: request.error,
          };
          this.recordError(error);
          reject(error);
        };
      });
    });
  }

  /**
   * Delete an analysis by ID
   */
  async deleteAnalysis(id: string): Promise<void> {
    await this.initialize();
    return this.executeOperation('delete', async () => {
      if (!this.db) throw new Error('Database not initialized');

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([this.config.storeName!], 'readwrite');
        const store = transaction.objectStore(this.config.storeName!);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          const error: PersistenceError = {
            code: 'DELETE_FAILED',
            message: `Failed to delete analysis: ${request.error?.message || 'Unknown error'}`,
            details: request.error,
          };
          this.recordError(error);
          reject(error);
        };
      });
    });
  }

  /**
   * Clear all analyses
   */
  async clearAll(): Promise<void> {
    await this.initialize();
    return this.executeOperation('clear', async () => {
      if (!this.db) throw new Error('Database not initialized');

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([this.config.storeName!], 'readwrite');
        const store = transaction.objectStore(this.config.storeName!);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => {
          const error: PersistenceError = {
            code: 'CLEAR_FAILED',
            message: `Failed to clear analyses: ${request.error?.message || 'Unknown error'}`,
            details: request.error,
          };
          this.recordError(error);
          reject(error);
        };
      });
    });
  }

  /**
   * Get persistence metadata
   */
  async getMetadata(): Promise<PersistenceMetadata> {
    await this.initialize();
    const all = await this.getAllAnalyses();
    return {
      version: this.config.dbVersion!,
      lastSync: Date.now(),
      totalAnalyses: all.length,
      storageSize: await this.estimateStorageSize(),
    };
  }

  /**
   * Get operation statistics
   */
  getStats(): PersistenceStats {
    return { ...this.stats };
  }

  /**
   * Validate analysis data integrity
   */
  private validateAnalysis(analysis: PersistedAnalysis): void {
    if (!analysis.id || typeof analysis.id !== 'string') {
      throw new Error('Invalid analysis: missing or invalid id');
    }
    if (!analysis.url || typeof analysis.url !== 'string') {
      throw new Error('Invalid analysis: missing or invalid url');
    }
    if (typeof analysis.timestamp !== 'number' || analysis.timestamp <= 0) {
      throw new Error('Invalid analysis: missing or invalid timestamp');
    }
    if (!analysis.result || typeof analysis.result !== 'object') {
      throw new Error('Invalid analysis: missing or invalid result');
    }
    if (typeof analysis.version !== 'number') {
      throw new Error('Invalid analysis: missing or invalid version');
    }

    // Validate nested structures
    if (analysis.result.issues && !Array.isArray(analysis.result.issues)) {
      throw new Error('Invalid analysis: result.issues must be an array');
    }
    if (analysis.result.summary && typeof analysis.result.summary !== 'object') {
      throw new Error('Invalid analysis: result.summary must be an object');
    }
  }

  /**
   * Migrate analysis to current schema version if needed
   */
  private migrateIfNeeded(analysis: PersistedAnalysis): PersistedAnalysis {
    const currentVersion = this.config.dbVersion!;
    if (analysis.version >= currentVersion) {
      return analysis;
    }

    // Perform migrations
    let migrated = { ...analysis };

    // Migration from version 0 to 1: ensure all required fields exist
    if (migrated.version < 1) {
      migrated = {
        ...migrated,
        version: 1,
        snapshot: migrated.snapshot || null,
        qaTestResult: migrated.qaTestResult || null,
      };
    }

    // Future migrations can be added here
    // if (migrated.version < 2) { ... }

    return migrated;
  }

  /**
   * Enforce maximum entries limit
   */
  private async enforceMaxEntries(): Promise<void> {
    if (!this.config.maxEntries) return;

    const all = await this.getAllAnalyses();
    if (all.length < this.config.maxEntries!) return;

    // Delete oldest entries
    const toDelete = all
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, all.length - this.config.maxEntries! + 1);

    for (const analysis of toDelete) {
      await this.deleteAnalysis(analysis.id);
    }
  }

  /**
   * Estimate storage size (approximate)
   */
  private async estimateStorageSize(): Promise<number> {
    if (!this.db) return 0;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.config.storeName!], 'readonly');
      const store = transaction.objectStore(this.config.storeName!);
      const request = store.getAll();

      request.onsuccess = () => {
        const data = JSON.stringify(request.result);
        resolve(new Blob([data]).size);
      };

      request.onerror = () => resolve(0);
    });
  }

  /**
   * Execute an operation with error handling and statistics
   */
  private async executeOperation<T>(
    operation: 'read' | 'write' | 'delete' | 'clear' | 'migrate',
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    this.stats.totalOperations++;

    try {
      const result = await fn();
      this.stats.successfulOperations++;
      const duration = performance.now() - startTime;
      this.stats.lastOperationTime = duration;
      this.updateAverageOperationTime(duration);
      return result;
    } catch (error) {
      this.stats.failedOperations++;
      const duration = performance.now() - startTime;
      this.stats.lastOperationTime = duration;
      this.updateAverageOperationTime(duration);
      throw error;
    }
  }

  /**
   * Update average operation time
   */
  private updateAverageOperationTime(duration: number): void {
    const total = this.stats.successfulOperations + this.stats.failedOperations;
    this.stats.averageOperationTime =
      (this.stats.averageOperationTime * (total - 1) + duration) / total;
  }

  /**
   * Record an error
   */
  private recordError(error: PersistenceError): void {
    this.stats.errors.push(error);
    // Keep only last 100 errors
    if (this.stats.errors.length > 100) {
      this.stats.errors = this.stats.errors.slice(-100);
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// Singleton instance
let persistenceService: IndexedDBPersistenceService | null = null;

export function getPersistenceService(config?: Partial<PersistenceConfig>): IndexedDBPersistenceService {
  if (!persistenceService) {
    persistenceService = new IndexedDBPersistenceService(config);
  }
  return persistenceService;
}
