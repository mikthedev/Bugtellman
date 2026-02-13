/**
 * Data Persistence Module - Public API
 * 
 * Exports all persistence-related functionality
 */

export { IndexedDBPersistenceService, getPersistenceService } from './indexeddb-service';
export { usePersistence } from './use-persistence';
export type {
  PersistedAnalysis,
  PersistenceMetadata,
  PersistenceConfig,
  PersistenceError,
  PersistenceOperation,
  PersistenceStats,
} from './types';
