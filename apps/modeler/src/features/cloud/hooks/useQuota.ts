// src/features/cloud/hooks/useQuota.ts
// Fetches GET /users/me/quota, caches the result for 30 s, and re-fetches
// whenever `invalidateQuota()` is called (e.g. after a diagram save or delete).

import { useState, useEffect, useCallback, useRef } from 'react';
import { getQuota } from '../../../api/quota.api';
import type { QuotaResponse } from '../../../api/types';
import { useAuthStore } from '../../auth/store/auth.store';

// ── Module-level cache ────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000; // 30 s

let _cachedQuota: QuotaResponse | null = null;
let _cacheTimestamp = 0;

// Lightweight pub-sub so mounted hook instances react to external invalidation.
const _listeners = new Set<() => void>();

/**
 * Clears the quota cache and notifies all mounted `useQuota` hook instances to
 * re-fetch. Call this after any successful diagram save or delete.
 */
export function invalidateQuota(): void {
  _cachedQuota    = null;
  _cacheTimestamp = 0;
  _listeners.forEach((fn) => fn());
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseQuotaResult {
  quota:   QuotaResponse | null;
  loading: boolean;
  error:   string | null;
  /** Bypass the cache and fetch immediately. */
  refetch: () => Promise<void>;
}

export function useQuota(): UseQuotaResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [quota,   setQuota]   = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Always-current reference so the subscription listener below never captures
  // a stale closure.
  const fetchRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const fetchQuota = useCallback(async () => {
    if (!isAuthenticated) {
      setQuota(null);
      return;
    }

    // Serve from cache when still fresh
    const now = Date.now();
    if (_cachedQuota !== null && now - _cacheTimestamp < CACHE_TTL_MS) {
      setQuota(_cachedQuota);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data      = await getQuota();
      _cachedQuota    = data;
      _cacheTimestamp = Date.now();
      setQuota(data);
    } catch {
      setError('Failed to load storage quota');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Keep the ref current on every render (before effects run).
  fetchRef.current = fetchQuota;

  // Fetch on mount and whenever auth state changes.
  useEffect(() => {
    void fetchRef.current?.();
  }, [isAuthenticated]);

  // Subscribe to external invalidation (diagram save / delete).
  useEffect(() => {
    const listener = () => void fetchRef.current?.();
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  return { quota, loading, error, refetch: fetchQuota };
}
