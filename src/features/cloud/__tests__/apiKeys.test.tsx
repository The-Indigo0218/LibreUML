// src/features/cloud/__tests__/apiKeys.test.ts
//
// Integration tests for the API Keys feature (Phase 2 / Task 3).
//
// Coverage:
//   • useApiKeys hook — fetchKeys, createKey, revokeApiKey, clearCreatedKey
//   • ApiKeyCreatedDialog — raw key display, copy feedback, dismiss
//   • ApiKeysPage — list rendering, empty/error states, revoke confirmation UX
//
// Mocks (module-level, Vitest-hoisted):
//   • src/api/apiKeys.api   — vi.fn() stubs, no network
//   • react-i18next         — t(key) → key  (avoids i18next bootstrap)
//   • react-router-dom      — Link stubbed to <a> (async factory avoids hoisting issue)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useApiKeys } from '../hooks/useApiKeys';
import ApiKeyCreatedDialog from '../components/ApiKeyCreatedDialog';
import ApiKeysPage from '../components/ApiKeysPage';
import type { ApiKeyResponse, ApiKeyCreatedResponse } from '../../../api/types';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../../api/apiKeys.api', () => ({
  generateKey: vi.fn(),
  listKeys:    vi.fn(),
  revokeKey:   vi.fn(),
}));

// t(key, opts?) → key, substituting {{placeholders}} so interpolation tests work
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>): string => {
      if (!opts) return key;
      return Object.entries(opts).reduce<string>(
        (s, [k, v]) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
        key,
      );
    },
  }),
}));

// Async factory — createElement is imported via dynamic import to avoid
// Vitest's vi.mock hoisting problem (factory runs before module imports bind).
vi.mock('react-router-dom', async () => {
  const { createElement } = await import('react');
  return {
    Link: ({ children, to }: { children: unknown; to: string }) =>
      createElement('a', { href: to }, children as React.ReactNode),
  };
});

import * as apiKeysApi from '../../../api/apiKeys.api';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const KEY_A: ApiKeyResponse = {
  id:         'key-1',
  name:       'CI Pipeline',
  scope:      'read',
  createdAt:  '2026-01-15T10:00:00Z',
  lastUsedAt: '2026-04-01T08:30:00Z',
  revoked:    false,
};

const KEY_B: ApiKeyResponse = {
  id:         'key-2',
  name:       'Deploy Bot',
  scope:      'write',
  createdAt:  '2026-02-20T12:00:00Z',
  lastUsedAt: null,
  revoked:    false,
};

const CREATED: ApiKeyCreatedResponse = {
  id:        'key-99',
  name:      'My New Key',
  scope:     'write',
  key:       'sk-live-abcdef1234567890abcdef1234567890',
  createdAt: new Date().toISOString(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockListKeys(keys: ApiKeyResponse[] = [KEY_A, KEY_B]) {
  vi.mocked(apiKeysApi.listKeys).mockResolvedValue(keys);
}

function makeHttpError(status: number, message = 'error') {
  return Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { message } },
  });
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

// jsdom v27 implements navigator.clipboard natively. defineProperty cannot
// shadow it because the Clipboard API is defined as a getter on the Navigator
// prototype. Use vi.spyOn to intercept writeText on the existing object so
// mockResolvedValue prevents the real (security-error) implementation from running.
// If jsdom doesn't expose clipboard, fall back to defineProperty.
let mockClipboardWrite: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockListKeys();
  vi.mocked(apiKeysApi.generateKey).mockResolvedValue(CREATED);
  vi.mocked(apiKeysApi.revokeKey).mockResolvedValue(undefined);

  if (navigator.clipboard?.writeText) {
    // jsdom has a native Clipboard — spy on the existing writeText method
    mockClipboardWrite = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined) as ReturnType<typeof vi.fn>;
  } else {
    // jsdom has no clipboard — define one
    mockClipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value:        { writeText: mockClipboardWrite },
      writable:     true,
      configurable: true,
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks(); // also restores vi.spyOn clipboard
});

// ═════════════════════════════════════════════════════════════════════════════
// useApiKeys hook
// ═════════════════════════════════════════════════════════════════════════════

describe('useApiKeys — initial state', () => {
  it('starts empty with no loading, no error, and no createdKey', () => {
    const { result } = renderHook(() => useApiKeys());

    expect(result.current.keys).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.createdKey).toBeNull();
  });
});

describe('useApiKeys — fetchKeys()', () => {
  it('populates the keys array on success', async () => {
    const { result } = renderHook(() => useApiKeys());

    await act(async () => { await result.current.fetchKeys(); });

    expect(result.current.keys).toHaveLength(2);
    expect(result.current.keys[0].name).toBe('CI Pipeline');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error to "fetchError" when the API rejects', async () => {
    vi.mocked(apiKeysApi.listKeys).mockRejectedValue(new Error('Network'));

    const { result } = renderHook(() => useApiKeys());

    await act(async () => { await result.current.fetchKeys(); });

    expect(result.current.error).toBe('fetchError');
    expect(result.current.keys).toHaveLength(0);
  });
});

describe('useApiKeys — createKey()', () => {
  it('sets createdKey to the server response (contains raw key)', async () => {
    const { result } = renderHook(() => useApiKeys());

    await act(async () => {
      await result.current.createKey({ name: 'My New Key', scope: 'write' });
    });

    expect(result.current.createdKey).not.toBeNull();
    expect(result.current.createdKey?.key).toBe(CREATED.key);
    expect(result.current.createdKey?.name).toBe('My New Key');
  });

  it('optimistically prepends the new key to the list', async () => {
    const { result } = renderHook(() => useApiKeys());
    await act(async () => { await result.current.fetchKeys(); });
    const countBefore = result.current.keys.length;

    await act(async () => {
      await result.current.createKey({ name: 'My New Key', scope: 'write' });
    });

    expect(result.current.keys).toHaveLength(countBefore + 1);
    expect(result.current.keys[0].name).toBe(CREATED.name);
  });

  it('propagates errors on API failure (does not swallow them)', async () => {
    vi.mocked(apiKeysApi.generateKey).mockRejectedValue(new Error('500'));

    const { result } = renderHook(() => useApiKeys());

    await expect(
      act(async () => { await result.current.createKey({ name: 'Bad', scope: 'read' }); }),
    ).rejects.toThrow();
  });

  it('clearCreatedKey sets createdKey back to null', async () => {
    const { result } = renderHook(() => useApiKeys());
    await act(async () => {
      await result.current.createKey({ name: 'My New Key', scope: 'write' });
    });
    expect(result.current.createdKey).not.toBeNull();

    act(() => { result.current.clearCreatedKey(); });

    expect(result.current.createdKey).toBeNull();
  });
});

describe('useApiKeys — revokeApiKey()', () => {
  it('removes the revoked key from the list (optimistic)', async () => {
    const { result } = renderHook(() => useApiKeys());
    await act(async () => { await result.current.fetchKeys(); });
    expect(result.current.keys).toHaveLength(2);

    await act(async () => { await result.current.revokeApiKey('key-1'); });

    expect(result.current.keys).toHaveLength(1);
    expect(result.current.keys.find((k) => k.id === 'key-1')).toBeUndefined();
  });

  it('propagates errors on API failure and leaves list unchanged', async () => {
    vi.mocked(apiKeysApi.revokeKey).mockRejectedValue(new Error('forbidden'));

    const { result } = renderHook(() => useApiKeys());
    await act(async () => { await result.current.fetchKeys(); });

    await expect(
      act(async () => { await result.current.revokeApiKey('key-1'); }),
    ).rejects.toThrow();

    // Keys are unchanged after a failed revoke
    expect(result.current.keys).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ApiKeyCreatedDialog component
// ═════════════════════════════════════════════════════════════════════════════

describe('ApiKeyCreatedDialog — raw key display', () => {
  it('renders the raw key value', () => {
    render(<ApiKeyCreatedDialog createdKey={CREATED} onClose={vi.fn()} />);

    expect(screen.getByText(CREATED.key)).toBeTruthy();
  });

  it('shows the non-recoverability warning banner', () => {
    render(<ApiKeyCreatedDialog createdKey={CREATED} onClose={vi.fn()} />);

    expect(screen.getByText('apiKeys.created.warning')).toBeTruthy();
  });

  it('displays key name and scope in the metadata section', () => {
    render(<ApiKeyCreatedDialog createdKey={CREATED} onClose={vi.fn()} />);

    expect(screen.getByText(CREATED.name)).toBeTruthy();
    expect(screen.getByText(CREATED.scope)).toBeTruthy();
  });

  it('"Done" button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ApiKeyCreatedDialog createdKey={CREATED} onClose={onClose} />);

    await user.click(screen.getByText('apiKeys.created.done'));

    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('ApiKeyCreatedDialog — copy to clipboard', () => {
  it('copy button writes the raw key to the clipboard', async () => {
    const user = userEvent.setup();
    render(<ApiKeyCreatedDialog createdKey={CREATED} onClose={vi.fn()} />);

    await user.click(screen.getByTitle('apiKeys.created.copy'));

    // Use the module-level spy reference — navigator.clipboard may be re-shadowed
    // by jsdom after defineProperty, so don't re-read it via navigator.clipboard.writeText
    expect(mockClipboardWrite).toHaveBeenCalledWith(CREATED.key);
  });

  it('shows "Copied!" confirmation text after clicking copy', async () => {
    const user = userEvent.setup();
    render(<ApiKeyCreatedDialog createdKey={CREATED} onClose={vi.fn()} />);

    await user.click(screen.getByTitle('apiKeys.created.copy'));

    expect(screen.getByText('apiKeys.created.copied')).toBeTruthy();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ApiKeysPage component
// ═════════════════════════════════════════════════════════════════════════════

describe('ApiKeysPage — key list rendering', () => {
  it('renders a row for each active key including name and scope', async () => {
    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('CI Pipeline')).toBeTruthy();
      expect(screen.getByText('Deploy Bot')).toBeTruthy();
    });
  });

  it('shows the formatted creation date for each key', async () => {
    render(<ApiKeysPage />);

    await waitFor(() => {
      const expectedDate = new Date(KEY_A.createdAt).toLocaleDateString();
      expect(screen.getByText(expectedDate)).toBeTruthy();
    });
  });

  it('shows "apiKeys.table.never" for a key with no lastUsedAt', async () => {
    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('apiKeys.table.never')).toBeTruthy();
    });
  });

  it('shows the empty-state message when the list is empty', async () => {
    mockListKeys([]);
    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('apiKeys.empty')).toBeTruthy();
    });
  });

  it('shows the fetch error key when listKeys rejects', async () => {
    vi.mocked(apiKeysApi.listKeys).mockRejectedValue(new Error('Network'));
    render(<ApiKeysPage />);

    await waitFor(() => {
      expect(screen.getByText('apiKeys.errors.fetchError')).toBeTruthy();
    });
  });
});

// The i18n mock returns the key path unchanged (t('apiKeys.revokeAriaLabel', {name})
// → 'apiKeys.revokeAriaLabel' since the key path contains no {{name}} literal).
// So all revoke buttons share the same aria-label. Index into getAllByRole to
// target each row: [0] = CI Pipeline, [1] = Deploy Bot.
const REVOKE_LABEL = 'apiKeys.revokeAriaLabel';

describe('ApiKeysPage — revoke confirmation flow', () => {
  it('clicking the revoke button shows an inline confirmation strip', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await waitFor(() => screen.getByText('CI Pipeline'));

    const [revokeFirst] = screen.getAllByRole('button', { name: REVOKE_LABEL });
    await user.click(revokeFirst);

    expect(screen.getByText('apiKeys.revokeConfirm.confirm')).toBeTruthy();
  });

  it('clicking Cancel hides the confirmation strip', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await waitFor(() => screen.getByText('CI Pipeline'));
    const [revokeFirst] = screen.getAllByRole('button', { name: REVOKE_LABEL });
    await user.click(revokeFirst);
    expect(screen.getByText('apiKeys.revokeConfirm.confirm')).toBeTruthy();

    await user.click(screen.getByText('modals.common.cancel'));

    expect(screen.queryByText('apiKeys.revokeConfirm.confirm')).toBeNull();
  });

  it('confirming revoke calls revokeKey API with the correct ID', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await waitFor(() => screen.getByText('CI Pipeline'));
    const [revokeFirst] = screen.getAllByRole('button', { name: REVOKE_LABEL });
    await user.click(revokeFirst);
    await user.click(screen.getByText('apiKeys.revokeConfirm.confirm'));

    await waitFor(() => {
      expect(apiKeysApi.revokeKey).toHaveBeenCalledWith('key-1');
    });
  });

  it('confirmed revoke removes the key from the rendered list', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await waitFor(() => screen.getByText('CI Pipeline'));
    const [revokeFirst] = screen.getAllByRole('button', { name: REVOKE_LABEL });
    await user.click(revokeFirst);
    await user.click(screen.getByText('apiKeys.revokeConfirm.confirm'));

    await waitFor(() => {
      expect(screen.queryByText('CI Pipeline')).toBeNull();
    });
    // The other key remains
    expect(screen.getByText('Deploy Bot')).toBeTruthy();
  });

  it('only one confirmation strip is visible at a time', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await waitFor(() => screen.getByText('CI Pipeline'));
    await waitFor(() => screen.getByText('Deploy Bot'));

    // Open confirmation for row 0 (CI Pipeline)
    const [revokeFirst] = screen.getAllByRole('button', { name: REVOKE_LABEL });
    await user.click(revokeFirst);
    expect(screen.getAllByText('apiKeys.revokeConfirm.confirm')).toHaveLength(1);

    // Open confirmation for row 1 (Deploy Bot) — should replace the first strip
    const revokeBtns = screen.getAllByRole('button', { name: REVOKE_LABEL });
    // [1] is Deploy Bot's button; [0] is now disabled (pending revoke for CI Pipeline)
    await user.click(revokeBtns[1]);
    expect(screen.getAllByText('apiKeys.revokeConfirm.confirm')).toHaveLength(1);
  });

  it('shows revokeError message when the API call fails', async () => {
    vi.mocked(apiKeysApi.revokeKey).mockRejectedValue(makeHttpError(500));
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await waitFor(() => screen.getByText('CI Pipeline'));
    const [revokeFirst] = screen.getAllByRole('button', { name: REVOKE_LABEL });
    await user.click(revokeFirst);
    await user.click(screen.getByText('apiKeys.revokeConfirm.confirm'));

    await waitFor(() => {
      expect(screen.getByText('apiKeys.errors.revokeError')).toBeTruthy();
    });
  });
});

describe('ApiKeysPage — create key flow', () => {
  it('shows ApiKeyCreatedDialog with raw key after successful creation', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await user.click(screen.getByText('apiKeys.generateButton'));
    await user.type(screen.getByLabelText('apiKeys.form.nameLabel'), 'My New Key');
    await user.click(screen.getByText('apiKeys.form.generate'));

    await waitFor(() => {
      expect(screen.getByText(CREATED.key)).toBeTruthy();
      expect(screen.getByText('apiKeys.created.warning')).toBeTruthy();
    });
  });

  it('closing the created-key dialog removes it and the raw key from the DOM', async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    await user.click(screen.getByText('apiKeys.generateButton'));
    await user.type(screen.getByLabelText('apiKeys.form.nameLabel'), 'My New Key');
    await user.click(screen.getByText('apiKeys.form.generate'));

    await waitFor(() => screen.getByText('apiKeys.created.done'));
    await user.click(screen.getByText('apiKeys.created.done'));

    expect(screen.queryByText(CREATED.key)).toBeNull();
    expect(screen.queryByText('apiKeys.created.warning')).toBeNull();
  });
});
