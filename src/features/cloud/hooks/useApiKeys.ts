// src/features/cloud/hooks/useApiKeys.ts
// Manages API key list state and orchestrates create/revoke operations.
// Callers get a stable fetchKeys reference so ApiKeysPage can call it in useEffect.

import { useState, useCallback } from 'react';
import { listKeys, generateKey, revokeKey } from '../../../api/apiKeys.api';
import type {
  ApiKeyResponse,
  ApiKeyCreatedResponse,
  CreateApiKeyRequest,
} from '../../../api/types';

export interface UseApiKeysResult {
  keys: ApiKeyResponse[];
  isLoading: boolean;
  /** i18n error key (e.g. 'fetchError') or null */
  error: string | null;
  /** Non-null immediately after a successful generateKey — cleared by clearCreatedKey */
  createdKey: ApiKeyCreatedResponse | null;
  fetchKeys: () => Promise<void>;
  createKey: (req: CreateApiKeyRequest) => Promise<void>;
  revokeApiKey: (id: string) => Promise<void>;
  clearCreatedKey: () => void;
}

export function useApiKeys(): UseApiKeysResult {
  const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedResponse | null>(null);

  const fetchKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listKeys();
      setKeys(result);
    } catch {
      setError('fetchError');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createKey = useCallback(async (req: CreateApiKeyRequest) => {
    setError(null);
    const result = await generateKey(req);
    setCreatedKey(result);
    // Optimistically prepend to list (no raw key in ApiKeyResponse shape)
    setKeys((prev) => [
      {
        id: result.id,
        name: result.name,
        scope: result.scope,
        createdAt: result.createdAt,
        lastUsedAt: null,
        revoked: false,
      },
      ...prev,
    ]);
  }, []);

  const revokeApiKey = useCallback(async (id: string) => {
    await revokeKey(id);
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }, []);

  const clearCreatedKey = useCallback(() => {
    setCreatedKey(null);
  }, []);

  return { keys, isLoading, error, createdKey, fetchKeys, createKey, revokeApiKey, clearCreatedKey };
}
