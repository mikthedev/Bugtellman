/**
 * Data Persistence & State Integrity - Type Definitions
 */

import type { AnalysisResult } from '@/lib/qa-engine';
import type { AutomatedTestResult } from '@/lib/qa-engine/automated-testing';
import type { DOMSnapshot } from '@/lib/qa-engine/visual-regression';

export interface PersistedAnalysis {
  id: string;
  url: string;
  timestamp: number;
  result: AnalysisResult;
  qaTestResult: AutomatedTestResult | null;
  snapshot: DOMSnapshot | null;
  version: number; // Schema version for migrations
}

export interface PersistenceMetadata {
  version: number;
  lastSync: number;
  totalAnalyses: number;
  storageSize: number;
}

export interface PersistenceConfig {
  dbName: string;
  dbVersion: number;
  storeName: string;
  maxEntries?: number; // Max number of analyses to keep
  enableCompression?: boolean;
  enableEncryption?: boolean;
}

export interface PersistenceError {
  code: string;
  message: string;
  details?: unknown;
}

export type PersistenceOperation = 'read' | 'write' | 'delete' | 'clear' | 'migrate';

export interface PersistenceStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageOperationTime: number;
  lastOperationTime: number;
  errors: PersistenceError[];
}
