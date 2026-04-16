import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

/**
 * Wraps private routes. While the session check is in-flight, shows a
 * centered spinner. On confirmed 401 (no session), redirects to /login —
 * unless the user explicitly chose local (offline) mode from the login page.
 */
export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isLocalMode = useAuthStore((s) => s.isLocalMode);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-700 border-t-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated && !isLocalMode) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
