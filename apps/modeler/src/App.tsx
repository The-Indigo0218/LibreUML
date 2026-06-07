import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import DiagramEditor from './features/diagram/components/layout/DiagramEditor';
import MobileGuard from './features/diagram/components/layout/MobileGuard';
import ProtectedRoute from './features/auth/components/ProtectedRoute';
import OAuthCallback from './features/auth/components/OAuthCallback';
import LoginPage from './features/auth/components/LoginPage';
import ResetPasswordPage from './features/auth/components/ResetPasswordPage';
import VerifyEmailPage from './features/auth/components/VerifyEmailPage';
import { useAuthStore } from './features/auth/store/auth.store';

const ApiKeysPage = lazy(() => import('./features/cloud/components/ApiKeysPage'));

// Playwright drag harness — registered only under the VITE_E2E build flag, so it
// is tree-shaken out of normal builds (auth-free, public route).
const E2EHarness = import.meta.env.VITE_E2E
  ? lazy(() => import('./e2e/E2EHarness'))
  : null;

function AppRoutes() {
  const checkSession = useAuthStore((s) => s.checkSession);

  // Run session check once on mount — sets user on 200, no-ops on 401.
  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  return (
    <Routes>
      {/* E2E drag harness (VITE_E2E only) — public, auth-free */}
      {E2EHarness && (
        <Route
          path="/__e2e"
          element={
            <Suspense fallback={null}>
              <E2EHarness />
            </Suspense>
          }
        />
      )}

      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/oauth/callback" element={<OAuthCallback />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* Protected routes — ProtectedRoute shows spinner while isLoading,
          redirects to /login if unauthenticated */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DiagramEditor />} />
        <Route
          path="/settings/api-keys"
          element={
            <Suspense fallback={null}>
              <ApiKeysPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <MobileGuard />
      <AppRoutes />
      <Analytics />
    </BrowserRouter>
  );
}

export default App;
