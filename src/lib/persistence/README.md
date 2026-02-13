# Data Persistence & State Integrity Module

Comprehensive data persistence layer with robust state integrity testing for Bugtellman.

## Features

- **IndexedDB-based Storage**: Client-side persistence using IndexedDB for reliable, large-scale data storage
- **Data Integrity Validation**: Automatic validation of data structure and consistency
- **Schema Migrations**: Versioned schema with automatic migration support
- **Concurrent Access Handling**: Safe handling of concurrent read/write operations
- **Error Recovery**: Graceful error handling with detailed error tracking
- **State Consistency**: Ensures data consistency across operations
- **Comprehensive Testing**: Extensive test suite covering all scenarios

## Architecture

```
src/lib/persistence/
├── types.ts                 # Type definitions
├── indexeddb-service.ts     # Core persistence service
├── use-persistence.ts      # React hook for persistence
├── index.ts                # Public API exports
├── __tests__/
│   ├── indexeddb-service.test.ts  # Core service tests
│   ├── state-integrity.test.ts    # State integrity tests
│   ├── integration.test.ts        # Integration tests
│   └── setup.ts                   # Test setup
└── README.md               # This file
```

## Usage

### React Hook (Recommended)

```typescript
import { usePersistence } from '@/lib/persistence';

function MyComponent() {
  const { isInitialized, saveAnalysis, getAnalysisByUrl } = usePersistence();

  // Save analysis
  await saveAnalysis(url, result, qaTestResult, snapshot);

  // Retrieve analysis
  const persisted = await getAnalysisByUrl(url);
}
```

### Direct Service Usage

```typescript
import { getPersistenceService } from '@/lib/persistence';

const service = getPersistenceService();
await service.initialize();

// Save
await service.saveAnalysis(analysis);

// Retrieve
const analysis = await service.getAnalysis(id);
const byUrl = await service.getAnalysisByUrl(url);
const all = await service.getAllAnalyses();

// Delete
await service.deleteAnalysis(id);
```

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run once (CI mode)
npm run test:run
```

## Test Coverage

The test suite includes:

1. **Basic CRUD Operations**: Create, Read, Update, Delete
2. **Data Integrity Validation**: Ensures data structure correctness
3. **Concurrent Access**: Tests simultaneous operations
4. **Error Recovery**: Tests error handling and recovery
5. **Schema Migrations**: Tests version migration logic
6. **State Consistency**: Ensures state remains consistent
7. **Edge Cases**: Handles boundary conditions
8. **Integration Tests**: Real-world usage scenarios

## Configuration

Default configuration:

```typescript
{
  dbName: 'bugtellman-db',
  dbVersion: 1,
  storeName: 'analyses',
  maxEntries: 100,        // Maximum analyses to keep
  enableCompression: false,
  enableEncryption: false,
}
```

Customize via service constructor:

```typescript
const service = new IndexedDBPersistenceService({
  dbName: 'custom-db',
  maxEntries: 50,
});
```

## Data Structure

```typescript
interface PersistedAnalysis {
  id: string;
  url: string;
  timestamp: number;
  result: AnalysisResult;
  qaTestResult: AutomatedTestResult | null;
  snapshot: DOMSnapshot | null;
  version: number;  // Schema version
}
```

## Error Handling

All operations include comprehensive error handling:

- Validation errors for invalid data
- Database errors with detailed messages
- Error tracking in statistics
- Graceful degradation when persistence fails

## Performance

- Efficient IndexedDB usage with proper indexing
- Automatic cleanup of old entries (maxEntries)
- Optimized queries with indexes
- Batch operations support

## Browser Compatibility

Requires IndexedDB support (all modern browsers):
- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- Opera: ✅

## Future Enhancements

- Compression support for large datasets
- Encryption for sensitive data
- Sync with remote storage
- Advanced querying capabilities
- Data export/import
