import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from '../auth.store';
import type { UserResponse } from '../../../../api/types';

// ── Module mock ──────────────────────────────────────────────────────────────

vi.mock('../../../../api/auth.api', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

import * as authApi from '../../../../api/auth.api';

// ── Test helpers ─────────────────────────────────────────────────────────────

const mockUser: UserResponse = {
  id: 'user-123',
  fullName: 'Test User',
  email: 'test@libreuml.com',
  role: 'DEVELOPER',
  academicDegrees: [],
  organization: [],
  stacks: [],
};

function resetStore() {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useAuthStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── checkSession ────────────────────────────────────────────────────────

  describe('checkSession()', () => {
    it('sets user + isAuthenticated on 200', async () => {
      vi.mocked(authApi.getMe).mockResolvedValueOnce(mockUser);

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('stays unauthenticated and clears loading on 401 (no visible error)', async () => {
      const err = Object.assign(new Error('Unauthorized'), { response: { status: 401 } });
      vi.mocked(authApi.getMe).mockRejectedValueOnce(err);

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      // 401 on mount must NOT surface an error string
      expect(state.error).toBeNull();
    });

    it('sets isLoading to true while in-flight', async () => {
      let resolveMe!: (v: UserResponse) => void;
      vi.mocked(authApi.getMe).mockReturnValueOnce(
        new Promise<UserResponse>((resolve) => { resolveMe = resolve; }),
      );

      const promise = useAuthStore.getState().checkSession();
      expect(useAuthStore.getState().isLoading).toBe(true);
      resolveMe(mockUser);
      await promise;
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  // ── login ───────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('sets user on success', async () => {
      vi.mocked(authApi.login).mockResolvedValueOnce(undefined);
      vi.mocked(authApi.getMe).mockResolvedValueOnce(mockUser);

      await useAuthStore.getState().login('test@libreuml.com', 'password');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('sets error and throws on failure', async () => {
      vi.mocked(authApi.login).mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(
        useAuthStore.getState().login('bad@example.com', 'wrong'),
      ).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Invalid credentials');
    });
  });

  // ── logout ──────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('clears user and isAuthenticated on success', async () => {
      // Seed an authenticated state
      useAuthStore.setState({ user: mockUser, isAuthenticated: true, isLoading: false });
      vi.mocked(authApi.logout).mockResolvedValueOnce(undefined);

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('still clears state even if the network call fails', async () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true, isLoading: false });
      vi.mocked(authApi.logout).mockRejectedValueOnce(new Error('Network error'));

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  // ── clearError ──────────────────────────────────────────────────────────

  describe('clearError()', () => {
    it('clears the error field', () => {
      useAuthStore.setState({ error: 'Some error' });
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  // ── auth:session-expired event ──────────────────────────────────────────

  describe('auth:session-expired window event', () => {
    it('clears auth state when fired', () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true, isLoading: false });

      window.dispatchEvent(new CustomEvent('auth:session-expired'));

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });
});
