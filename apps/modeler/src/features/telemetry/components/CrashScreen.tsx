// CrashScreen — fallback UI for Sentry.ErrorBoundary at the app root.
//
// Deliberately dependency-free: no i18n, no store reads, no design-system
// imports. This renders when something in the app already crashed, so it
// must not be able to fail itself by depending on other subsystems.

interface CrashScreenProps {
  error: unknown;
  resetError: () => void;
}

export default function CrashScreen({ error, resetError }: CrashScreenProps) {
  const isDev = import.meta.env.DEV;
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
      <h1 className="text-xl font-semibold text-gray-800">Something went wrong</h1>
      <p className="max-w-md text-sm text-gray-600">
        LibreUML hit an unexpected error and had to stop this screen. Your
        project is auto-saved locally — reloading should bring it back.
      </p>
      {isDev && (
        <pre className="max-w-xl overflow-auto rounded bg-red-50 p-3 text-left text-xs text-red-700">
          {message}
        </pre>
      )}
      <div className="flex gap-3">
        <button
          onClick={resetError}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Reload the app
        </button>
      </div>
    </div>
  );
}
