// src/api/apiKeys.api.ts
// REST calls for API key management (POST/GET/DELETE /api-keys).
// All three endpoints are authenticated — cookies handled by Axios withCredentials.

import apiClient from './client';
import type {
  ApiKeyResponse,
  ApiKeyCreatedResponse,
  CreateApiKeyRequest,
} from './types';

/**
 * Generate a new API key.
 * The response contains the raw key exactly once — the backend only stores the hash.
 */
export async function generateKey(
  req: CreateApiKeyRequest,
): Promise<ApiKeyCreatedResponse> {
  const { data } = await apiClient.post<ApiKeyCreatedResponse>('/api-keys', req);
  return data;
}

/** List all API keys belonging to the authenticated user (excludes revoked keys). */
export async function listKeys(): Promise<ApiKeyResponse[]> {
  const { data } = await apiClient.get<ApiKeyResponse[]>('/api-keys');
  return data;
}

/** Revoke (permanently delete) an API key by ID. */
export async function revokeKey(id: string): Promise<void> {
  await apiClient.delete(`/api-keys/${id}`);
}
