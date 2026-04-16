import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

/**
 * Landing page for the OAuth redirect from the backend.
 *
 * Backend flow:
 *   GET /api/v1/oauth/{provider}/callback
 *   → sets __Host-jwt + __Host-refresh cookies
 *   → redirects to frontend /oauth/callback
 *
 * This component calls checkSession() to exchange the fresh cookies for
 * user data, then navigates to the editor.
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const checkSession = useAuthStore((s) => s.checkSession);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    checkSession().then(() => {
      // checkSession updates the store; navigation happens in the next effect
    });
  }, [checkSession]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
    if (!isLoading && !isAuthenticated) {
      // Session check failed — cookies invalid or expired during redirect
      navigate('/login', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-700 border-t-blue-500" />
        <p className="text-sm text-neutral-400">Completing sign-in…</p>
      </div>
    </div>
  );
}
