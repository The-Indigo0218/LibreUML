import { useAuthStore } from '../store/auth.store';

/**
 * Convenience hook that exposes auth state and actions from useAuthStore.
 * Components should prefer this hook over calling useAuthStore directly so
 * the selector shape stays stable.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const checkSession = useAuthStore((s) => s.checkSession);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const clearError = useAuthStore((s) => s.clearError);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    checkSession,
    login,
    logout,
    clearError,
  };
}
