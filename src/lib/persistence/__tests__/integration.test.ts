/**
 * Integration Tests for Data Persistence
 * 
 * Tests the persistence service in realistic scenarios
 * that mirror actual application usage patterns.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDBPersistenceService } from '../indexeddb-service';
import type { PersistedAnalysis } from '../types';
import type { AnalysisResult } from '@/lib/qa-engine';
import type { AutomatedTestResult } from '@/lib/qa-engine/automated-testing';
import type { DOMSnapshot } from '@/lib/qa-engine/visual-regression';

function createRealisticAnalysis(id: string, url: string): PersistedAnalysis {
  const result: AnalysisResult = {
    issues: [
      {
        id: 'issue-1',
        category: 'Links',
        severity: 'high',
        title: '404 - Page not found',
        description: 'Link returns 404',
        url: 'https://example.com/dead',
      },
      {
        id: 'issue-2',
        category: 'Accessibility',
        severity: 'medium',
        title: 'Image missing alt text',
        description: 'img element has no alt attribute',
        selector: 'img.hero',
      },
    ],
    summary: {
      total: 2,
      urgent: 0,
      high: 1,
      medium: 1,
      low: 0,
      minor: 0,
    },
    stats: {
      totalPages: 1,
      totalLinks: 10,
      brokenLinks: 1,
      totalImages: 5,
      imagesWithoutAlt: 1,
    },
    analyzedUrl: url,
    pageScreenshot: 'https://example.com/screenshot.png',
  };

  const qaTestResult: AutomatedTestResult = {
    userJourney: {
      flows: [],
      results: [],
    },
    stateTesting: [],
    visualRegression: {
      snapshot: {
        url,
        timestamp: Date.now(),
        elements: [],
      },
      visualDiffs: [],
    },
    performance: {
      metrics: [],
    },
        authCheck: {
          found: false,
          discoveries: [],
          issues: [],
          summary: {
            loginFound: false,
            registerFound: false,
            issuesCount: 0,
            highOrUrgentCount: 0,
          },
        },
    summary: {
      userJourney: { passed: 0, total: 0, secondLevelPassed: 0, secondLevelTotal: 0 },
      stateTesting: { passed: 0, total: 0, withFailures: 0 },
      visualRegression: { diffCount: 0 },
      performance: { slowCount: 0, total: 0, thresholdMs: 3000 },
      authCheck: { found: false, issuesCount: 0, highOrUrgentCount: 0 },
    },
  };

  const snapshot: DOMSnapshot = {
    url,
    timestamp: Date.now(),
    elements: [
      {
        selector: 'header',
        x: 0,
        y: 0,
        width: 1200,
        height: 80,
        tagName: 'HEADER',
      },
      {
        selector: 'main',
        x: 0,
        y: 80,
        width: 1200,
        height: 800,
        tagName: 'MAIN',
      },
    ],
  };

  return {
    id,
    url,
    timestamp: Date.now(),
    result,
    qaTestResult,
    snapshot,
    version: 1,
  };
}

// Simplified IndexedDB mock for integration tests
function setupIndexedDBMock() {
  const stores = new Map<string, Map<string, any>>();

  global.indexedDB = {
    open: (name: string, version?: number) => {
      const request = {
        result: {
          objectStoreNames: {
            contains: (name: string) => stores.has(name),
          },
              createObjectStore: (name: string) => {
                if (!stores.has(name)) stores.set(name, new Map());
                const store = stores.get(name)!;
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
          transaction: (storeNames: string[], mode?: string) => {
            const names = Array.isArray(storeNames) ? storeNames : [storeNames];
            return {
              objectStore: (name: string) => {
                if (!stores.has(name)) stores.set(name, new Map());
                const store = stores.get(name)!;
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
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as any;

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

describe('Integration Tests - Data Persistence', () => {
  let service: IndexedDBPersistenceService;

  beforeEach(() => {
    setupIndexedDBMock();
    service = new IndexedDBPersistenceService({
      dbName: 'test-integration',
      dbVersion: 1,
      storeName: 'analyses',
    });
  });

  afterEach(() => {
    service.close();
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle complete analysis workflow', async () => {
      await service.initialize();

      // Simulate analyzing a URL
      const analysis = createRealisticAnalysis('analysis-1', 'https://example.com');
      await service.saveAnalysis(analysis);

      // Retrieve for display
      const retrieved = await service.getAnalysis('analysis-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.result.issues.length).toBe(2);
      expect(retrieved?.result.summary.high).toBe(1);
      expect(retrieved?.snapshot).toBeDefined();
      expect(retrieved?.snapshot?.elements.length).toBe(2);
    });

    it('should handle multiple URL analyses', async () => {
      await service.initialize();

      const urls = [
        'https://example.com',
        'https://example.org',
        'https://example.net',
      ];

      for (let i = 0; i < urls.length; i++) {
        const analysis = createRealisticAnalysis(`analysis-${i}`, urls[i]);
        await service.saveAnalysis(analysis);
      }

      const all = await service.getAllAnalyses();
      expect(all.length).toBe(3);

      // Verify each URL
      for (let i = 0; i < urls.length; i++) {
        const byUrl = await service.getAnalysisByUrl(urls[i]);
        expect(byUrl).toBeDefined();
        expect(byUrl?.url).toBe(urls[i]);
      }
    });

    it('should handle re-analysis of same URL', async () => {
      await service.initialize();

      const url = 'https://example.com';

      // First analysis
      const analysis1 = createRealisticAnalysis('analysis-1', url);
      analysis1.timestamp = 1000;
      await service.saveAnalysis(analysis1);

      // Second analysis (re-analysis)
      const analysis2 = createRealisticAnalysis('analysis-2', url);
      analysis2.timestamp = 2000;
      analysis2.result.issues = []; // Different results
      await service.saveAnalysis(analysis2);

      // Should get most recent
      const recent = await service.getAnalysisByUrl(url);
      expect(recent?.timestamp).toBe(2000);
      expect(recent?.result.issues.length).toBe(0);
    });

    it('should maintain state across app lifecycle', async () => {
      await service.initialize();

      // Simulate app session 1
      const analysis1 = createRealisticAnalysis('session-1', 'https://example.com');
      await service.saveAnalysis(analysis1);

      // Simulate app restart (new service instance)
      const newService = new IndexedDBPersistenceService({
        dbName: 'test-integration',
        dbVersion: 1,
        storeName: 'analyses',
      });
      await newService.initialize();

      // Should still have previous data
      const retrieved = await newService.getAnalysis('session-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.url).toBe('https://example.com');

      newService.close();
    });
  });

  describe('Data Integrity in Complex Scenarios', () => {
    it('should handle large result sets', async () => {
      await service.initialize();

      const analysis = createRealisticAnalysis('large-analysis', 'https://example.com');
      
      // Add many issues
      analysis.result.issues = Array.from({ length: 100 }, (_, i) => ({
        id: `issue-${i}`,
        category: 'Links',
        severity: 'medium' as const,
        title: `Issue ${i}`,
        description: `Description ${i}`,
      }));

      await service.saveAnalysis(analysis);

      const retrieved = await service.getAnalysis('large-analysis');
      expect(retrieved?.result.issues.length).toBe(100);
    });

    it('should handle nested complex structures', async () => {
      await service.initialize();

      const analysis = createRealisticAnalysis('complex-analysis', 'https://example.com');
      
      // Complex QA test result
      analysis.qaTestResult = {
        userJourney: {
          flows: [
            {
              type: 'nav',
              selector: 'a.nav-link',
              href: 'https://example.com/page',
              text: 'Page',
            },
          ],
          results: [
            {
              path: ['https://example.com', 'https://example.com/page'],
              success: true,
              failures: [],
              steps: [
                {
                  url: 'https://example.com/page',
                  selector: 'a.nav-link',
                  action: 'click',
                  success: true,
                  durationMs: 150,
                },
              ],
              durationMs: 150,
            },
          ],
        },
        stateTesting: [
          {
            inputName: 'email',
            state: 'valid',
            value: 'test@example.com',
            submitted: true,
            success: true,
            failures: [],
          },
        ],
        visualRegression: {
          snapshot: analysis.snapshot!,
          visualDiffs: [
            {
              selector: 'header',
              changeType: 'element_moved',
              severity: 'medium',
              description: 'Header moved',
            },
          ],
        },
        performance: {
          metrics: [
            {
              name: 'navigation',
              type: 'navigation',
              url: 'https://example.com',
              durationMs: 1200,
              success: true,
            },
          ],
        },
        authCheck: {
          found: true,
          discoveries: [
            {
              kind: 'form',
              pageUrl: 'https://example.com/login',
              label: 'Login',
              actionUrl: '/login',
              method: 'post',
              inferredType: 'login',
            },
          ],
          issues: [],
          summary: {
            loginFound: true,
            registerFound: false,
            issuesCount: 0,
            highOrUrgentCount: 0,
          },
        },
        summary: {
          userJourney: { passed: 1, total: 1, secondLevelPassed: 0, secondLevelTotal: 0 },
          stateTesting: { passed: 1, total: 1, withFailures: 0 },
          visualRegression: { diffCount: 1 },
          performance: { slowCount: 0, total: 1, thresholdMs: 3000 },
          authCheck: { found: true, issuesCount: 0, highOrUrgentCount: 0 },
        },
      };

      await service.saveAnalysis(analysis);

      const retrieved = await service.getAnalysis('complex-analysis');
      expect(retrieved?.qaTestResult).toBeDefined();
      expect(retrieved?.qaTestResult?.userJourney.flows.length).toBe(1);
      expect(retrieved?.qaTestResult?.visualRegression.visualDiffs.length).toBe(1);
    });

    it('should handle partial data (missing optional fields)', async () => {
      await service.initialize();

      const analysis: PersistedAnalysis = {
        id: 'partial-analysis',
        url: 'https://example.com',
        timestamp: Date.now(),
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
        },
        qaTestResult: null,
        snapshot: null,
        version: 1,
      };

      await service.saveAnalysis(analysis);

      const retrieved = await service.getAnalysis('partial-analysis');
      expect(retrieved).toBeDefined();
      expect(retrieved?.qaTestResult).toBeNull();
      expect(retrieved?.snapshot).toBeNull();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle many analyses efficiently', async () => {
      await service.initialize();

      const startTime = Date.now();
      const count = 50;

      for (let i = 0; i < count; i++) {
        const analysis = createRealisticAnalysis(`perf-${i}`, `https://example${i}.com`);
        await service.saveAnalysis(analysis);
      }

      const saveTime = Date.now() - startTime;

      const readStartTime = Date.now();
      const all = await service.getAllAnalyses();
      const readTime = Date.now() - readStartTime;

      expect(all.length).toBe(count);
      expect(saveTime).toBeLessThan(5000); // Should complete in reasonable time
      expect(readTime).toBeLessThan(2000);
    });

    it('should maintain performance with max entries limit', async () => {
      const limitedService = new IndexedDBPersistenceService({
        dbName: 'test-perf-limited',
        dbVersion: 1,
        storeName: 'analyses',
        maxEntries: 10,
      });

      await limitedService.initialize();

      // Add more than max
      for (let i = 0; i < 20; i++) {
        const analysis = createRealisticAnalysis(`perf-${i}`, `https://example${i}.com`);
        await limitedService.saveAnalysis(analysis);
      }

      const all = await limitedService.getAllAnalyses();
      expect(all.length).toBeLessThanOrEqual(10);

      limitedService.close();
    });
  });
});
