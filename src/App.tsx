import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import DiagramEditor from './features/diagram/components/layout/DiagramEditor';
import MobileGuard from './features/diagram/components/layout/MobileGuard';
import ProtectedRoute from './features/auth/components/ProtectedRoute';
import OAuthCallback from './features/auth/components/OAuthCallback';
import LoginPage from './features/auth/components/LoginPage';
import { useAuthStore } from './features/auth/store/auth.store';

const ApiKeysPage = lazy(() => import('./features/cloud/components/ApiKeysPage'));

function AppRoutes() {
  const checkSession = useAuthStore((s) => s.checkSession);

  // Run session check once on mount — sets user on 200, no-ops on 401.
  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/oauth/callback" element={<OAuthCallback />} />

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
