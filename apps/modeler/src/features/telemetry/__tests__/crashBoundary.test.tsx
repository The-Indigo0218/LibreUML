import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sentry } from '../sentry.client';
import CrashScreen from '../components/CrashScreen';

/** Throws on first render only, so "Try again" can recover it. */
function Bomb({ armed }: { armed: boolean }) {
  if (armed) throw new Error('boom');
  return <div>fine</div>;
}

describe('app-root Sentry.ErrorBoundary + CrashScreen', () => {
  it('renders CrashScreen instead of crashing the whole app when a child throws', () => {
    // React logs the error to console.error during the throwing render —
    // expected noise for this test, not a real failure.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <Sentry.ErrorBoundary fallback={CrashScreen}>
        <Bomb armed={true} />
      </Sentry.ErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    expect(screen.queryByText('fine')).toBeNull();
  });

  it('"Try again" re-renders the children instead of reloading the page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let armed = true;

    const { rerender } = render(
      <Sentry.ErrorBoundary fallback={CrashScreen}>
        <Bomb armed={armed} />
      </Sentry.ErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();

    // Disarm the bomb, then click "Try again" — the boundary re-mounts its
    // children, so this time they render clean instead of re-throwing.
    armed = false;
    rerender(
      <Sentry.ErrorBoundary fallback={CrashScreen}>
        <Bomb armed={armed} />
      </Sentry.ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('fine')).toBeTruthy();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });
});
