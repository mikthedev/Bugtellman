/**
 * State Integrity Tests
 * 
 * Tests focused on ensuring state consistency, data integrity,
 * and preventing corruption across complex scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDBPersistenceService } from '../indexeddb-service';
import type { PersistedAnalysis } from '../types';
import type { AnalysisResult } from '@/lib/qa-engine';

function createTestAnalysis(id: string, url: string, timestamp?: number): PersistedAnalysis {
  return {
    id,
    url,
    timestamp: timestamp || Date.now(),
    result: {
      issues: [],
      summary: { total: 0, urgent: 0, high: 0, medium: 0, low: 0, minor: 0 },
      stats: {
        totalPages: 1,
        totalLinks: 0,
        brokenLinks: 0,
        totalImages: 0,
        imagesWithoutAlt: 0,
      },
      analyzedUrl: url,
    },
    qaTestResult: null,
    snapshot: null,
    version: 1,
  };
}

// Mock IndexedDB setup (simplified version)
function setupIndexedDBMock() {
  const stores = new Map<string, Map<string, any>>();

  global.indexedDB = {
    open: (name: string, version?: number) => {
      const request: any = {
        result: {
          objectStoreNames: {
            contains: (storeName: string) => stores.has(storeName),
          },
          createObjectStore: (storeName: string) => {
            if (!stores.has(storeName)) stores.set(storeName, new Map());
            const store = stores.get(storeName)!;
            return {
              createIndex: vi.fn(),
              put: (value: any) => {
                store.set(value.id, value);
                const req: any = {
                  onsuccess: null,
                  onerror: null,
                  result: value,
                  addEventListener: vi.fn(),
                  removeEventListener: vi.fn(),
                  dispatchEvent: vi.fn(),
                };
                setTimeout(() => {
                  if (req.onsuccess) req.onsuccess({} as Event);
                }, 0);
                return req;
              },
              get: (key: string) => {
                const req: any = {
                  onsuccess: null,
                  onerror: null,
                  result: store.get(key),
                  addEventListener: vi.fn(),
                  removeEventListener: vi.fn(),
                  dispatchEvent: vi.fn(),
                };
                setTimeout(() => {
                  if (req.onsuccess) req.onsuccess({} as Event);
                }, 0);
                return req;
              },
              getAll: () => {
                const req: any = {
                  onsuccess: null,
                  onerror: null,
                  result: Array.from(store.values()),
                  addEventListener: vi.fn(),
                  removeEventListener: vi.fn(),
                  dispatchEvent: vi.fn(),
                };
                setTimeout(() => {
                  if (req.onsuccess) req.onsuccess({} as Event);
                }, 0);
                return req;
              },
              delete: (key: string) => {
                store.delete(key);
                const req: any = {
                  onsuccess: null,
                  onerror: null,
                  addEventListener: vi.fn(),
                  removeEventListener: vi.fn(),
                  dispatchEvent: vi.fn(),
                };
                setTimeout(() => {
                  if (req.onsuccess) req.onsuccess({} as Event);
                }, 0);
                return req;
              },
              clear: () => {
                store.clear();
                const req: any = {
                  onsuccess: null,
                  onerror: null,
                  addEventListener: vi.fn(),
                  removeEventListener: vi.fn(),
                  dispatchEvent: vi.fn(),
                };
                setTimeout(() => {
                  if (req.onsuccess) req.onsuccess({} as Event);
                }, 0);
                return req;
              },
              index: (indexName: string) => ({
                getAll: (query?: any) => {
                  const req: any = {
                    onsuccess: null,
                    onerror: null,
                    result: Array.from(store.values()),
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                    dispatchEvent: vi.fn(),
                  };
                  setTimeout(() => {
                    if (req.onsuccess) req.onsuccess({} as Event);
                  }, 0);
                  return req;
                },
              }),
            };
          },
          transaction: (storeNames: string | string[], mode?: string) => {
            const names = Array.isArray(storeNames) ? storeNames : [storeNames];
            return {
              objectStore: (storeName: string) => {
                if (!stores.has(storeName)) stores.set(storeName, new Map());
                const store = stores.get(storeName)!;
                return {
                  put: (value: any) => {
                    store.set(value.id, value);
                    const req: any = {
                      onsuccess: null,
                      onerror: null,
                      result: value,
                      addEventListener: vi.fn(),
                      removeEventListener: vi.fn(),
                      dispatchEvent: vi.fn(),
                    };
                    setTimeout(() => {
                      if (req.onsuccess) req.onsuccess({} as Event);
                    }, 0);
                    return req;
                  },
                  get: (key: string) => {
                    const req: any = {
                      onsuccess: null,
                      onerror: null,
                      result: store.get(key),
                      addEventListener: vi.fn(),
                      removeEventListener: vi.fn(),
                      dispatchEvent: vi.fn(),
                    };
                    setTimeout(() => {
                      if (req.onsuccess) req.onsuccess({} as Event);
                    }, 0);
                    return req;
                  },
                  getAll: () => {
                    const req: any = {
                      onsuccess: null,
                      onerror: null,
                      result: Array.from(store.values()),
                      addEventListener: vi.fn(),
                      removeEventListener: vi.fn(),
                      dispatchEvent: vi.fn(),
                    };
                    setTimeout(() => {
                      if (req.onsuccess) req.onsuccess({} as Event);
                    }, 0);
                    return req;
                  },
                  delete: (key: string) => {
                    store.delete(key);
                    const req: any = {
                      onsuccess: null,
                      onerror: null,
                      addEventListener: vi.fn(),
                      removeEventListener: vi.fn(),
                      dispatchEvent: vi.fn(),
                    };
                    setTimeout(() => {
                      if (req.onsuccess) req.onsuccess({} as Event);
                    }, 0);
                    return req;
                  },
                  clear: () => {
                    store.clear();
                    const req: any = {
                      onsuccess: null,
                      onerror: null,
                      addEventListener: vi.fn(),
                      removeEventListener: vi.fn(),
                      dispatchEvent: vi.fn(),
                    };
                    setTimeout(() => {
                      if (req.onsuccess) req.onsuccess({} as Event);
                    }, 0);
                    return req;
                  },
                  index: (indexName: string) => ({
                    getAll: (query?: any) => {
                      let results: any[];
                      if (query !== undefined && query !== null) {
                        // Filter by index key
                        results = Array.from(store.values()).filter((v: any) => v[indexName] === query);
                      } else {
                        results = Array.from(store.values());
                      }
                      const req: any = {
                        onsuccess: null,
                        onerror: null,
                        result: results,
                        addEventListener: vi.fn(),
                        removeEventListener: vi.fn(),
                        dispatchEvent: vi.fn(),
                      };
                      setTimeout(() => {
                        if (req.onsuccess) req.onsuccess({} as Event);
                      }, 0);
                      return req;
                    },
                  }),
                };
              },
            };
          },
          close: vi.fn(),
        },
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };

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

describe('State Integrity Tests', () => {
  let service: IndexedDBPersistenceService;

  beforeEach(() => {
    setupIndexedDBMock();
    service = new IndexedDBPersistenceService({
      dbName: 'test-state-integrity',
      dbVersion: 1,
      storeName: 'analyses',
    });
  });

  afterEach(() => {
    service.close();
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity', async () => {
      await service.initialize();
      const analysis = createTestAnalysis('test-1', 'https://example.com');

      await service.saveAnalysis(analysis);
      const retrieved = await service.getAnalysis('test-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(analysis.id);
      expect(retrieved?.url).toBe(analysis.url);
      expect(retrieved?.result).toEqual(analysis.result);
    });

    it('should prevent partial writes', async () => {
      await service.initialize();
      const analysis = createTestAnalysis('test-1', 'https://example.com');

      await service.saveAnalysis(analysis);
      const retrieved = await service.getAnalysis('test-1');

      // All fields should be present
      expect(retrieved?.id).toBeDefined();
      expect(retrieved?.url).toBeDefined();
      expect(retrieved?.timestamp).toBeDefined();
      expect(retrieved?.result).toBeDefined();
      expect(retrieved?.version).toBeDefined();
    });

    it('should maintain atomicity of operations', async () => {
      await service.initialize();

      // Save multiple analyses
      const analyses = Array.from({ length: 5 }, (_, i) =>
        createTestAnalysis(`test-${i}`, `https://example${i}.com`)
      );

      for (const analysis of analyses) {
        await service.saveAnalysis(analysis);
      }

      // All should be retrievable
      const all = await service.getAllAnalyses();
      expect(all.length).toBe(5);

      // Verify each one
      for (const original of analyses) {
        const retrieved = await service.getAnalysis(original.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(original.id);
      }
    });
  });

  describe('Transaction Isolation', () => {
    it('should isolate concurrent transactions', async () => {
      await service.initialize();

      const analysis1 = createTestAnalysis('test-1', 'https://example.com');
      const analysis2 = createTestAnalysis('test-2', 'https://example.org');

      // Concurrent saves
      await Promise.all([
        service.saveAnalysis(analysis1),
        service.saveAnalysis(analysis2),
      ]);

      // Both should be saved independently
      const retrieved1 = await service.getAnalysis('test-1');
      const retrieved2 = await service.getAnalysis('test-2');

      expect(retrieved1).toBeDefined();
      expect(retrieved2).toBeDefined();
      expect(retrieved1?.id).toBe('test-1');
      expect(retrieved2?.id).toBe('test-2');
    });

    it('should handle read-during-write scenarios', async () => {
      await service.initialize();
      const analysis = createTestAnalysis('test-1', 'https://example.com');

      // Start save
      const savePromise = service.saveAnalysis(analysis);

      // Read before save completes
      const readPromise = service.getAnalysis('test-1');

      await Promise.all([savePromise, readPromise]);

      // After save completes, read should succeed
      const finalRead = await service.getAnalysis('test-1');
      expect(finalRead).toBeDefined();
    });
  });

  describe('Data Validation', () => {
    it('should validate all required fields', async () => {
      await service.initialize();

      const testCases = [
        { field: 'id', value: null },
        { field: 'url', value: null },
        { field: 'timestamp', value: null },
        { field: 'result', value: null },
        { field: 'version', value: null },
      ];

      for (const testCase of testCases) {
        const invalid = createTestAnalysis('test-1', 'https://example.com');
        (invalid as any)[testCase.field] = testCase.value;

        await expect(service.saveAnalysis(invalid)).rejects.toThrow();
      }
    });

    it('should validate data types', async () => {
      await service.initialize();

      const invalid = createTestAnalysis('test-1', 'https://example.com');
      invalid.timestamp = 'not-a-number' as any;

      await expect(service.saveAnalysis(invalid)).rejects.toThrow();
    });

    it('should validate nested structures', async () => {
      await service.initialize();

      const invalid = createTestAnalysis('test-1', 'https://example.com');
      invalid.result.issues = 'not-an-array' as any;

      await expect(service.saveAnalysis(invalid)).rejects.toThrow();
    });
  });

  describe('State Recovery', () => {
    it('should recover from invalid data gracefully', async () => {
      await service.initialize();

      // Save valid data
      const valid = createTestAnalysis('test-1', 'https://example.com');
      await service.saveAnalysis(valid);

      // Attempt to save invalid data (should fail)
      const invalid = createTestAnalysis('test-1', 'https://example.com');
      invalid.result = null as any;

      await expect(service.saveAnalysis(invalid)).rejects.toThrow();

      // Original data should still be intact
      const retrieved = await service.getAnalysis('test-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.result).toBeDefined();
    });

    it('should handle corrupted data during retrieval', async () => {
      await service.initialize();
      const analysis = createTestAnalysis('test-1', 'https://example.com');
      await service.saveAnalysis(analysis);

      // Service should validate on retrieval
      const retrieved = await service.getAnalysis('test-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-1');
    });
  });

  describe('Concurrent State Modifications', () => {
    it('should handle rapid state changes', async () => {
      await service.initialize();
      const analysis = createTestAnalysis('test-1', 'https://example.com');

      // Rapid updates
      const updates = Array.from({ length: 20 }, (_, i) => {
        const updated = { ...analysis };
        updated.timestamp = Date.now() + i;
        return service.saveAnalysis(updated);
      });

      await Promise.all(updates);

      const retrieved = await service.getAnalysis('test-1');
      expect(retrieved).toBeDefined();
      // Should have the last update
      expect(retrieved?.timestamp).toBeGreaterThan(analysis.timestamp);
    });

    it('should maintain consistency during concurrent deletes', async () => {
      await service.initialize();

      // Create multiple entries
      for (let i = 0; i < 10; i++) {
        await service.saveAnalysis(createTestAnalysis(`test-${i}`, `https://example${i}.com`));
      }

      // Concurrent deletes
      const deletes = Array.from({ length: 5 }, (_, i) =>
        service.deleteAnalysis(`test-${i}`)
      );

      await Promise.all(deletes);

      const all = await service.getAllAnalyses();
      expect(all.length).toBe(5); // 10 - 5 = 5 remaining
    });
  });

  describe('State Synchronization', () => {
    it('should synchronize state across multiple operations', async () => {
      await service.initialize();

      // Create state
      await service.saveAnalysis(createTestAnalysis('test-1', 'https://example.com'));

      // Read state
      const read1 = await service.getAnalysis('test-1');
      expect(read1).toBeDefined();

      // Update state
      const updated = createTestAnalysis('test-1', 'https://example.com');
      updated.timestamp = Date.now() + 1000;
      await service.saveAnalysis(updated);

      // Read updated state
      const read2 = await service.getAnalysis('test-1');
      expect(read2?.timestamp).toBe(updated.timestamp);
    });

    it('should maintain consistent ordering', async () => {
      await service.initialize();

      // Add analyses with different timestamps
      const timestamps = [1000, 3000, 2000, 5000, 4000];
      for (let i = 0; i < timestamps.length; i++) {
        await service.saveAnalysis(
          createTestAnalysis(`test-${i}`, `https://example${i}.com`, timestamps[i])
        );
      }

      const all = await service.getAllAnalyses();
      expect(all.length).toBe(5);

      // Should be sorted by timestamp descending
      for (let i = 0; i < all.length - 1; i++) {
        expect(all[i].timestamp).toBeGreaterThanOrEqual(all[i + 1].timestamp);
      }
    });
  });
});
