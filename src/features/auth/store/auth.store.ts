import { create } from 'zustand';
import { getMe, login as apiLogin, logout as apiLogout } from '../../../api/auth.api';
import type { UserResponse } from '../../../api/types';

interface AuthStoreState {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLocalMode: boolean;
  error: string | null;

  checkSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  enterLocalMode: () => void;
}

export const useAuthStore = create<AuthStoreState>()((set) => ({
  // Start in loading state so ProtectedRoute shows a spinner until the
  // initial checkSession() call resolves on mount (success or 401).
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isLocalMode: false,
  error: null,

  checkSession: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      // 401 = no active session — expected, not an error state
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      await apiLogin({ email, password });
      const user = await getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Please try again.';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    // Best-effort server invalidation — if the network call fails, local state
    // is still cleared. The user is signed out locally regardless.
    try {
      await apiLogout();
    } catch {
      // intentionally swallowed
    }
    set({ user: null, isAuthenticated: false, isLoading: false, error: null, isLocalMode: false });
  },

  clearError: () => set({ error: null }),

  enterLocalMode: () => set({ isLocalMode: true }),
}));

// Subscribe to the session-expired event fired by client.ts on refresh failure
window.addEventListener('auth:session-expired', () => {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
});
