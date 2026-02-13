/**
 * React Hook for Data Persistence
 * 
 * Provides easy-to-use hooks for persisting and retrieving analysis data
 */

import { useEffect, useState, useCallback } from 'react';
import { getPersistenceService } from './indexeddb-service';
import type { PersistedAnalysis } from './types';
import type { AnalysisResult } from '@/lib/qa-engine';
import type { AutomatedTestResult } from '@/lib/qa-engine/automated-testing';
import type { DOMSnapshot } from '@/lib/qa-engine/visual-regression';

export function usePersistence() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const service = getPersistenceService();
    service
      .initialize()
      .then(() => setIsInitialized(true))
      .catch((err) => {
        setError(err instanceof Error ? err : new Error('Failed to initialize persistence'));
        setIsInitialized(false);
      });
  }, []);

  const saveAnalysis = useCallback(
    async (
      url: string,
      result: AnalysisResult,
      qaTestResult: AutomatedTestResult | null,
      snapshot: DOMSnapshot | null
    ): Promise<void> => {
      if (!isInitialized) {
        throw new Error('Persistence not initialized');
      }

      setIsLoading(true);
      setError(null);

      try {
        const service = getPersistenceService();
        const analysis: PersistedAnalysis = {
          id: `${url}-${Date.now()}`,
          url,
          timestamp: Date.now(),
          result,
          qaTestResult,
          snapshot,
          version: 1,
        };

        await service.saveAnalysis(analysis);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to save analysis');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [isInitialized]
  );

  const getAnalysisByUrl = useCallback(
    async (url: string): Promise<PersistedAnalysis | null> => {
      if (!isInitialized) {
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const service = getPersistenceService();
        return await service.getAnalysisByUrl(url);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to retrieve analysis');
        setError(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [isInitialized]
  );

  const getAllAnalyses = useCallback(async (): Promise<PersistedAnalysis[]> => {
    if (!isInitialized) {
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = getPersistenceService();
      return await service.getAllAnalyses();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to retrieve analyses');
      setError(error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  const deleteAnalysis = useCallback(
    async (id: string): Promise<void> => {
      if (!isInitialized) {
        throw new Error('Persistence not initialized');
      }

      setIsLoading(true);
      setError(null);

      try {
        const service = getPersistenceService();
        await service.deleteAnalysis(id);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete analysis');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [isInitialized]
  );

  return {
    isInitialized,
    isLoading,
    error,
    saveAnalysis,
    getAnalysisByUrl,
    getAllAnalyses,
    deleteAnalysis,
  };
}
