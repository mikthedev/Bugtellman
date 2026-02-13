/**
 * Test setup file for Vitest
 * Configures test environment and global mocks
 */

import { vi, afterEach } from 'vitest';

// Mock DOMStringList for IndexedDB mocks
if (typeof global.DOMStringList === 'undefined') {
  class DOMStringListMock extends Array<string> {
    contains(value: string): boolean {
      return this.includes(value);
    }
    item(index: number): string | null {
      return this[index] || null;
    }
  }
  (global as any).DOMStringList = DOMStringListMock;
}

// Mock window and global objects for IndexedDB
if (typeof global.window === 'undefined') {
  global.window = {} as any;
}

// Ensure performance API is available
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  } as any;
}

// Clean up after tests
afterEach(() => {
  vi.clearAllMocks();
});
