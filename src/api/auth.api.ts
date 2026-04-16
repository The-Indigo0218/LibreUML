import apiClient from './client';
import type { LoginRequest, RegisterRequest, UserResponse, OAuthAuthorizeResponse } from './types';

// POST /api/v1/auth/login → 204 No Content (tokens set as HttpOnly cookies)
export async function login(data: LoginRequest): Promise<void> {
  await apiClient.post('/auth/login', data);
}

// POST /api/v1/auth/register → 201 Created (no body)
export async function register(data: RegisterRequest): Promise<void> {
  await apiClient.post('/auth/register', data);
}

// DELETE /api/v1/auth/logout → 204 No Content
export async function logout(): Promise<void> {
  await apiClient.delete('/auth/logout');
}

// POST /api/v1/auth/refresh → 204 No Content (rotates cookies)
export async function refreshToken(): Promise<void> {
  await apiClient.post('/auth/refresh');
}

// GET /api/v1/users/me → 200 UserResponse
export async function getMe(): Promise<UserResponse> {
  const response = await apiClient.get<UserResponse>('/users/me');
  return response.data;
}

// GET /api/v1/oauth/{provider}/authorize?redirectUri=...
// redirectUri must be the backend callback URL registered with the OAuth provider,
// e.g. https://api.libreuml.com/api/v1/oauth/github/callback
export async function getOAuthUrl(
  provider: 'github' | 'google',
  redirectUri: string,
): Promise<OAuthAuthorizeResponse> {
  const response = await apiClient.get<OAuthAuthorizeResponse>(
    `/oauth/${provider}/authorize`,
    { params: { redirectUri } },
  );
  return response.data;
}
