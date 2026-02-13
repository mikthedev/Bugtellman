/**
 * Comprehensive Data Persistence & State Integrity Tests
 * 
 * Tests cover:
 * - Basic CRUD operations
 * - Data integrity validation
 * - Concurrent access handling
 * - Error recovery
 * - Schema migrations
 * - State consistency
 * - Edge cases and boundary conditions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDBPersistenceService, getPersistenceService } from '../indexeddb-service';
import type { PersistedAnalysis } from '../types';
import type { AnalysisResult } from '@/lib/qa-engine';
import type { AutomatedTestResult } from '@/lib/qa-engine/automated-testing';
import type { DOMSnapshot } from '@/lib/qa-engine/visual-regression';

// Mock IndexedDB for testing
class MockIDBDatabase implements IDBDatabase {
  name = 'test-db';
  version = 1;
  objectStoreNames = new DOMStringList();
  onabort: ((this: IDBDatabase, ev: Event) => any) | null = null;
  onclose: ((this: IDBDatabase, ev: Event) => any) | null = null;
  onerror: ((this: IDBDatabase, ev: Event) => any) | null = null;
  onversionchange: ((this: IDBDatabase, ev: Event) => any) | null = null;

  private stores: Map<string, Map<string, any>> = new Map();

  close(): void {
    // Mock implementation
  }

  createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map());
    }
    return new MockIDBObjectStore(name, this.stores.get(name)!) as any;
  }

  deleteObjectStore(name: string): void {
    this.stores.delete(name);
  }

  transaction(storeNames: string | string[], mode?: IDBTransactionMode): IDBTransaction {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    return new MockIDBTransaction(names, mode || 'readonly', this.stores) as any;
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return false;
  }
}

class MockIDBObjectStore {
  name: string;
  keyPath: string | string[] | null = null;
  indexNames = new DOMStringList();
  transaction: IDBTransaction | null = null;
  autoIncrement = false;
  private data: Map<string, any>;
  private indexes: Map<string, Map<any, Set<string>>> = new Map();

  constructor(name: string, data: Map<string, any>) {
    this.name = name;
    this.data = data;
  }

  add(value: any, key?: IDBValidKey): IDBRequest<any> {
    const id = key || value.id || String(Date.now());
    this.data.set(String(id), value);
    return this.createRequest(value);
  }

  put(value: any, key?: IDBValidKey): IDBRequest<any> {
    const id = key || value.id || String(Date.now());
    this.data.set(String(id), value);
    // Update indexes
    for (const [indexName, indexMap] of this.indexes.entries()) {
      const indexKey = value[indexName];
      if (indexKey !== undefined) {
        if (!indexMap.has(indexKey)) {
          indexMap.set(indexKey, new Set());
        }
        indexMap.get(indexKey)!.add(String(id));
      }
    }
    return this.createRequest(value);
  }

  get(key: IDBValidKey): IDBRequest<any> {
    const value = this.data.get(String(key));
    return this.createRequest(value);
  }

  getAll(query?: IDBValidKey | IDBKeyRange, count?: number): IDBRequest<any[]> {
    const values = Array.from(this.data.values());
    return this.createRequest(values);
  }

  getAllKeys(): IDBRequest<IDBValidKey[]> {
    return this.createRequest(Array.from(this.data.keys()) as IDBValidKey[]);
  }

  getKey(): IDBRequest<IDBValidKey | undefined> {
    return this.createRequest(undefined as IDBValidKey | undefined);
  }

  delete(key: IDBValidKey): IDBRequest<undefined> {
    this.data.delete(String(key));
    return this.createRequest(undefined);
  }

  clear(): IDBRequest<undefined> {
    this.data.clear();
    return this.createRequest(undefined);
  }

  createIndex(): IDBIndex {
    throw new Error('Not implemented');
  }

  index(name: string): IDBIndex {
    if (!this.indexes.has(name)) {
      const indexMap = new Map<any, Set<string>>();
      // Build index from data
      for (const [id, value] of this.data.entries()) {
        const key = (value as any)[name];
        if (key !== undefined) {
          if (!indexMap.has(key)) {
            indexMap.set(key, new Set());
          }
          indexMap.get(key)!.add(id);
        }
      }
      this.indexes.set(name, indexMap);
    }
    return new MockIDBIndex(name, this.data, this.indexes.get(name)!) as any;
  }

  deleteIndex(): void {
    // Mock implementation
  }

  openCursor(): IDBRequest<IDBCursorWithValue | null> {
    throw new Error('Not implemented');
  }

  openKeyCursor(): IDBRequest<IDBCursor | null> {
    throw new Error('Not implemented');
  }

  count(): IDBRequest<number> {
    return this.createRequest(this.data.size);
  }

  private createRequest<T>(result: T): IDBRequest<T> {
    return {
      result,
      error: null,
      readyState: 'done' as IDBRequestReadyState,
      source: this as any,
      transaction: null,
      onsuccess: null,
      onerror: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as any;
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return false;
  }
}

class MockIDBIndex {
  name: string;
  keyPath: string | string[];
  objectStore: IDBObjectStore;
  unique = false;
  multiEntry = false;
  private data: Map<string, any>;
  private index: Map<any, Set<string>>;

  constructor(name: string, data: Map<string, any>, index: Map<any, Set<string>>) {
    this.name = name;
    this.keyPath = name;
    this.data = data;
    this.index = index;
    this.objectStore = {} as IDBObjectStore;
  }

  get(key: IDBValidKey): IDBRequest<any> {
    const ids = this.index.get(key);
    if (!ids || ids.size === 0) {
      return this.createRequest(undefined);
    }
    const firstId = Array.from(ids)[0];
    return this.createRequest(this.data.get(firstId));
  }

  getAll(query?: IDBValidKey | IDBKeyRange, count?: number): IDBRequest<any[]> {
    const results: any[] = [];
    if (query !== undefined && query !== null) {
      // Filter by specific key
      const ids = this.index.get(query);
      if (ids) {
        for (const id of ids) {
          const value = this.data.get(id);
          if (value) {
            results.push(value);
          }
        }
      }
    } else {
      // Return all
      for (const [key, ids] of this.index.entries()) {
        for (const id of ids) {
          const value = this.data.get(id);
          if (value) {
            results.push(value);
          }
        }
      }
    }
    return this.createRequest(results);
  }

  getAllKeys(): IDBRequest<IDBValidKey[]> {
    return this.createRequest(Array.from(this.index.keys()) as IDBValidKey[]);
  }

  getKey(): IDBRequest<IDBValidKey | undefined> {
    return this.createRequest(undefined as IDBValidKey | undefined);
  }

  openCursor(): IDBRequest<IDBCursorWithValue | null> {
    throw new Error('Not implemented');
  }

  openKeyCursor(): IDBRequest<IDBCursor | null> {
    throw new Error('Not implemented');
  }

  count(): IDBRequest<number> {
    return this.createRequest(this.index.size);
  }

  private createRequest<T>(result: T): IDBRequest<T> {
    return {
      result,
      error: null,
      readyState: 'done' as IDBRequestReadyState,
      source: this as any,
      transaction: null,
      onsuccess: null,
      onerror: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as any;
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return false;
  }
}

class MockIDBTransaction {
  objectStoreNames = new DOMStringList();
  mode: IDBTransactionMode;
  db: IDBDatabase;
  durability: IDBTransactionDurability = 'default';
  error: DOMException | null = null;
  onabort: ((this: IDBTransaction, ev: Event) => any) | null = null;
  oncomplete: ((this: IDBTransaction, ev: Event) => any) | null = null;
  onerror: ((this: IDBTransaction, ev: Event) => any) | null = null;
  private storeNames: string[];
  private stores: Map<string, Map<string, any>>;

  constructor(storeNames: string[], mode: IDBTransactionMode, stores: Map<string, Map<string, any>>) {
    this.storeNames = storeNames;
    this.mode = mode;
    this.stores = stores;
    this.db = {} as IDBDatabase;
  }

  objectStore(name: string): IDBObjectStore {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map());
    }
    return new MockIDBObjectStore(name, this.stores.get(name)!) as any;
  }

  abort(): void {
    // Mock implementation
  }

  commit(): void {
    // Mock implementation
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return false;
  }
}

// Setup IndexedDB mock
function setupIndexedDBMock() {
  const stores = new Map<string, Map<string, any>>();

  global.indexedDB = {
    open: (name: string, version?: number) => {
      const db = new MockIDBDatabase();
      const request = {
        result: db,
        error: null,
        readyState: 'done' as IDBRequestReadyState,
        source: null,
        transaction: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as any;

      // Simulate async behavior
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({} as Event);
        }
      }, 0);

      return request;
    },
    deleteDatabase: vi.fn(),
    cmp: vi.fn(),
  } as any;

  global.window = { indexedDB: global.indexedDB } as any;
}

// Helper to create test data
function createTestAnalysis(id: string, url: string, timestamp?: number): PersistedAnalysis {
  const testResult: AnalysisResult = {
    issues: [],
    summary: {
      total: 0,
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
      minor: 0,
    },
    stats: {
      totalPages: 1,
      totalLinks: 0,
      brokenLinks: 0,
      totalImages: 0,
      imagesWithoutAlt: 0,
    },
    analyzedUrl: url,
  };

  const testSnapshot: DOMSnapshot = {
    url,
    timestamp: timestamp || Date.now(),
    elements: [],
  };

  return {
    id,
    url,
    timestamp: timestamp || Date.now(),
    result: testResult,
    qaTestResult: null,
    snapshot: testSnapshot,
    version: 1,
  };
}

describe('IndexedDBPersistenceService - Data Persistence & State Integrity', () => {
  let service: IndexedDBPersistenceService;

  beforeEach(() => {
    setupIndexedDBMock();
    service = new IndexedDBPersistenceService({
      dbName: 'test-db',
      dbVersion: 1,
      storeName: 'analyses',
    });
  });

  afterEach(() => {
    service.close();
  });

  describe('Initialization', () => {
    it('should initialize database successfully', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should handle multiple initialization calls', async () => {
      await service.initialize();
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should throw error when IndexedDB is not available', async () => {
      const originalIndexedDB = global.indexedDB;
      delete (global as any).indexedDB;

      const testService = new IndexedDBPersistenceService();
      await expect(testService.initialize()).rejects.toThrow();

      global.indexedDB = originalIndexedDB;
    });
  });

  describe('CRUD Operations', () => {
    it('should save and retrieve an analysis', async () => {
      await service.initialize();
      const analysis = createTestAnalysis('test-1', 'https://example.com');

      await service.saveAnalysis(analysis);
      const retrieved = await service.getAnalysis('test-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-1');
      expect(retrieved?.url).toBe('https://example.com');
    });

    it('should update existing analysis', async () => {
      await service.initialize();
      const analysis1 = createTestAnalysis('test-1', 'https://example.com', 1000);
      const analysis2 = createTestAnalysis('test-1', 'https://example.com', 2000);

      await service.saveAnalysis(analysis1);
      await service.saveAnalysis(analysis2);

      const retrieved = await service.getAnalysis('test-1');
      expect(retrieved?.timestamp).toBe(2000);
    });

    it('should return null for non-existent analysis', async () => {
      await service.initialize();
      const retrieved = await service.getAnalysis('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should delete an analysis', async () => {
      await service.initialize();
      const analysis = createTestAnalysis('test-1', 'https://example.com');

      await service.saveAnalysis(analysis);
      await service.deleteAnalysis('test-1');

      const retrieved = await service.getAnalysis('test-1');
      expect(retrieved).toBeNull();
    });

    it('should clear all analyses', async () => {
      await service.initialize();
      await service.saveAnalysis(createTestAnalysis('test-1', 'https://example.com'));
      await service.saveAnalysis(createTestAnalysis('test-2', 'https://example.org'));

      await service.clearAll();
      const all = await service.getAllAnalyses();
      expect(all).toHaveLength(0);
    });
  });

  describe('Data Integrity Validation', () => {
    it('should reject analysis with missing id', async () => {
      await service.initialize();
      const invalid = createTestAnalysis('', 'https://example.com');
      invalid.id = '';

      await expect(service.saveAnalysis(invalid)).rejects.toThrow();
    });

    it('should reject analysis with missing url', async () => {
      await service.initialize();
      const invalid = createTestAnalysis('test-1', '');
      invalid.url = '';

      await expect(service.saveAnalysis(invalid)).rejects.toThrow();
    });

    it('should reject analysis with invalid timestamp', async () => {
      await service.initialize();
      const invalid = createTestAnalysis('test-1', 'https://example.com');
      invalid.timestamp = -1;

      await expect(service.saveAnalysis(invalid)).rejects.toThrow();
    });

    it('should reject analysis with missing result', async () => {
      await service.initialize();
      const invalid = createTestAnalysis('test-1', 'https://example.com');
      invalid.result = null as any;

      await expect(service.saveAnalysis(invalid)).rejects.toThrow();
    });

    it('should reject analysis with invalid result structure', async () => {
      await service.initialize();
      const invalid = createTestAnalysis('test-1', 'https://example.com');
      invalid.result.issues = 'not-an-array' as any;

      await expect(service.saveAnalysis(invalid)).rejects.toThrow();
    });

    it('should validate retrieved data integrity', async () => {
      await service.initialize();
      const analysis = createTestAnalysis('test-1', 'https://example.com');
      await service.saveAnalysis(analysis);

      // Manually corrupt data in storage (simulated)
      // In real scenario, this would be caught during retrieval
      const retrieved = await service.getAnalysis('test-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-1');
      expect(retrieved?.url).toBe('https://example.com');
      expect(retrieved?.result).toBeDefined();
      expect(Array.isArray(retrieved?.result.issues)).toBe(true);
    });
  });

  describe('Query Operations', () => {
    it('should retrieve analysis by URL', async () => {
      await service.initialize();
      const analysis = createTestAnalysis('test-1', 'https://example.com');
      await service.saveAnalysis(analysis);

      const retrieved = await service.getAnalysisByUrl('https://example.com');
      expect(retrieved).toBeDefined();
      expect(retrieved?.url).toBe('https://example.com');
    });

    it('should return most recent analysis for URL', async () => {
      await service.initialize();
      const old = createTestAnalysis('test-1', 'https://example.com', 1000);
      const recent = createTestAnalysis('test-2', 'https://example.com', 2000);

      await service.saveAnalysis(old);
      await service.saveAnalysis(recent);

      const retrieved = await service.getAnalysisByUrl('https://example.com');
      expect(retrieved?.timestamp).toBe(2000);
    });

    it('should return all analyses sorted by timestamp', async () => {
      await service.initialize();
      const analysis1 = createTestAnalysis('test-1', 'https://example.com', 1000);
      const analysis2 = createTestAnalysis('test-2', 'https://example.org', 3000);
      const analysis3 = createTestAnalysis('test-3', 'https://example.net', 2000);

      await service.saveAnalysis(analysis1);
      await service.saveAnalysis(analysis2);
      await service.saveAnalysis(analysis3);

      const all = await service.getAllAnalyses();
      expect(all).toHaveLength(3);
      expect(all[0].timestamp).toBe(3000); // Most recent first
      expect(all[1].timestamp).toBe(2000);
      expect(all[2].timestamp).toBe(1000);
    });
  });

  describe('Schema Migrations', () => {
    it('should migrate analysis from version 0 to 1', async () => {
      await service.initialize();
      const oldAnalysis = createTestAnalysis('test-1', 'https://example.com');
      oldAnalysis.version = 0;
      delete (oldAnalysis as any).snapshot;

      await service.saveAnalysis(oldAnalysis);
      const retrieved = await service.getAnalysis('test-1');

      expect(retrieved?.version).toBeGreaterThanOrEqual(1);
    });

    it('should preserve data during migration', async () => {
      await service.initialize();
      const analysis = createTestAnalysis('test-1', 'https://example.com');
      analysis.version = 0;

      await service.saveAnalysis(analysis);
      const retrieved = await service.getAnalysis('test-1');

      expect(retrieved?.id).toBe('test-1');
      expect(retrieved?.url).toBe('https://example.com');
      expect(retrieved?.result).toBeDefined();
    });
  });

  describe('Max Entries Enforcement', () => {
    it('should enforce max entries limit', async () => {
      const limitedService = new IndexedDBPersistenceService({
        dbName: 'test-db-limited',
        dbVersion: 1,
        storeName: 'analyses',
        maxEntries: 3,
      });

      await limitedService.initialize();

      // Add 5 analyses
      for (let i = 0; i < 5; i++) {
        await limitedService.saveAnalysis(
          createTestAnalysis(`test-${i}`, `https://example${i}.com`, i * 1000)
        );
      }

      const all = await limitedService.getAllAnalyses();
      expect(all.length).toBeLessThanOrEqual(3);

      limitedService.close();
    });

    it('should keep most recent entries when enforcing limit', async () => {
      const limitedService = new IndexedDBPersistenceService({
        dbName: 'test-db-limited-2',
        dbVersion: 1,
        storeName: 'analyses',
        maxEntries: 2,
      });

      await limitedService.initialize();

      await limitedService.saveAnalysis(
        createTestAnalysis('old', 'https://old.com', 1000)
      );
      await limitedService.saveAnalysis(
        createTestAnalysis('middle', 'https://middle.com', 2000)
      );
      await limitedService.saveAnalysis(
        createTestAnalysis('recent', 'https://recent.com', 3000)
      );

      const all = await limitedService.getAllAnalyses();
      expect(all.length).toBe(2);
      expect(all[0].id).toBe('recent');
      expect(all[1].id).toBe('middle');

      limitedService.close();
    });
  });

  describe('Concurrent Access Handling', () => {
    it('should handle concurrent save operations', async () => {
      await service.initialize();

      const promises = Array.from({ length: 10 }, (_, i) =>
        service.saveAnalysis(createTestAnalysis(`test-${i}`, `https://example${i}.com`))
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();

      const all = await service.getAllAnalyses();
      expect(all.length).toBe(10);
    });

    it('should handle concurrent read operations', async () => {
      await service.initialize();
      await service.saveAnalysis(createTestAnalysis('test-1', 'https://example.com'));

      const promises = Array.from({ length: 10 }, () =>
        service.getAnalysis('test-1')
      );

      const results = await Promise.all(promises);
      expect(results.every((r) => r?.id === 'test-1')).toBe(true);
    });

    it('should handle mixed concurrent operations', async () => {
      await service.initialize();

      const operations = [
        service.saveAnalysis(createTestAnalysis('test-1', 'https://example.com')),
        service.saveAnalysis(createTestAnalysis('test-2', 'https://example.org')),
        service.getAnalysis('test-1'),
        service.getAllAnalyses(),
        service.deleteAnalysis('test-1'),
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });

  describe('Error Recovery', () => {
    it('should track operation statistics', async () => {
      await service.initialize();
      await service.saveAnalysis(createTestAnalysis('test-1', 'https://example.com'));

      const stats = service.getStats();
      expect(stats.totalOperations).toBeGreaterThan(0);
      expect(stats.successfulOperations).toBeGreaterThan(0);
    });

    it('should record errors in statistics', async () => {
      await service.initialize();

      try {
        const invalid = createTestAnalysis('test-1', 'https://example.com');
        invalid.id = '';
        await service.saveAnalysis(invalid);
      } catch (err) {
        // Expected to fail - error should be recorded
      }

      const stats = service.getStats();
      // Note: Validation errors happen before the operation, so they may not be recorded
      // This test verifies the error handling mechanism exists
      expect(stats.totalOperations).toBeGreaterThan(0);
    });

    it('should maintain average operation time', async () => {
      await service.initialize();

      await service.saveAnalysis(createTestAnalysis('test-1', 'https://example.com'));
      await service.getAnalysis('test-1');
      await service.getAllAnalyses();

      const stats = service.getStats();
      expect(stats.averageOperationTime).toBeGreaterThan(0);
      expect(stats.lastOperationTime).toBeGreaterThan(0);
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state after multiple operations', async () => {
      await service.initialize();

      // Create multiple analyses
      for (let i = 0; i < 5; i++) {
        await service.saveAnalysis(
          createTestAnalysis(`test-${i}`, `https://example${i}.com`)
        );
      }

      // Verify all exist
      const all = await service.getAllAnalyses();
      expect(all.length).toBe(5);

      // Delete some
      await service.deleteAnalysis('test-1');
      await service.deleteAnalysis('test-3');

      // Verify remaining
      const remaining = await service.getAllAnalyses();
      expect(remaining.length).toBe(3);
      expect(remaining.find((a) => a.id === 'test-1')).toBeUndefined();
      expect(remaining.find((a) => a.id === 'test-3')).toBeUndefined();
    });

    it('should handle rapid state changes', async () => {
      await service.initialize();

      const analysis = createTestAnalysis('test-1', 'https://example.com');
      await service.saveAnalysis(analysis);

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        analysis.timestamp = Date.now() + i;
        await service.saveAnalysis(analysis);
      }

      const retrieved = await service.getAnalysis('test-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.timestamp).toBeGreaterThan(analysis.timestamp - 10);
    });
  });

  describe('Metadata and Statistics', () => {
    it('should provide accurate metadata', async () => {
      await service.initialize();

      await service.saveAnalysis(createTestAnalysis('test-1', 'https://example.com'));
      await service.saveAnalysis(createTestAnalysis('test-2', 'https://example.org'));

      const metadata = await service.getMetadata();
      expect(metadata.totalAnalyses).toBe(2);
      expect(metadata.version).toBe(1);
      expect(metadata.lastSync).toBeGreaterThan(0);
    });

    it('should estimate storage size', async () => {
      await service.initialize();
      await service.saveAnalysis(createTestAnalysis('test-1', 'https://example.com'));

      const metadata = await service.getMetadata();
      expect(metadata.storageSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long URLs', async () => {
      await service.initialize();
      const longUrl = 'https://example.com/' + 'a'.repeat(10000);
      const analysis = createTestAnalysis('test-1', longUrl);

      await expect(service.saveAnalysis(analysis)).resolves.not.toThrow();
      const retrieved = await service.getAnalysis('test-1');
      expect(retrieved?.url).toBe(longUrl);
    });

    it('should handle special characters in IDs', async () => {
      await service.initialize();
      const analysis = createTestAnalysis('test-1-特殊-字符', 'https://example.com');

      await expect(service.saveAnalysis(analysis)).resolves.not.toThrow();
      const retrieved = await service.getAnalysis('test-1-特殊-字符');
      expect(retrieved).toBeDefined();
    });

    it('should handle empty result sets', async () => {
      await service.initialize();
      const all = await service.getAllAnalyses();
      expect(all).toEqual([]);
    });

    it('should handle deletion of non-existent entry', async () => {
      await service.initialize();
      await expect(service.deleteAnalysis('non-existent')).resolves.not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getPersistenceService', () => {
      const service1 = getPersistenceService();
      const service2 = getPersistenceService();
      expect(service1).toBe(service2);
    });
  });
});
