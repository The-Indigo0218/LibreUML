// src/features/cloud/components/ApiKeysPage.tsx
//
// Settings page for managing API keys used by MCP integrations.
// Route: /settings/api-keys (inside ProtectedRoute)
//
// Features:
//   • List active keys (name, scope, created date, last used date, revoke)
//   • Inline create form with name + scope selector
//   • Show-once dialog after key creation (ApiKeyCreatedDialog)
//   • Revoke with confirmation before deletion

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Key, Plus, Trash2, RefreshCw, ArrowLeft, AlertTriangle, X } from 'lucide-react';
import { useApiKeys } from '../hooks/useApiKeys';
import ApiKeyCreatedDialog from './ApiKeyCreatedDialog';
import type { ApiKeyScope } from '../../../api/types';

// ── Inline revoke confirmation ─────────────────────────────────────────────────

interface RevokeConfirmProps {
  keyName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isBusy: boolean;
}

function RevokeConfirm({ keyName, onConfirm, onCancel, isBusy }: RevokeConfirmProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-t border-red-500/30 text-xs">
      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-red-300">
        {t('apiKeys.revokeConfirm.message', { name: keyName })}
      </span>
      <button
        onClick={onCancel}
        disabled={isBusy}
        className="px-2 py-1 rounded text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
      >
        {t('modals.common.cancel')}
      </button>
      <button
        onClick={onConfirm}
        disabled={isBusy}
        className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isBusy ? t('apiKeys.revokeConfirm.revoking') : t('apiKeys.revokeConfirm.confirm')}
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const { t } = useTranslation();
  const {
    keys,
    isLoading,
    error,
    createdKey,
    fetchKeys,
    createKey,
    revokeApiKey,
    clearCreatedKey,
  } = useApiKeys();

  // ── Create form ────────────────────────────────────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScope, setNewKeyScope] = useState<ApiKeyScope>('read');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Revoke confirmation ────────────────────────────────────────────────────
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  useEffect(() => {
    void fetchKeys();
  }, [fetchKeys]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      await createKey({ name: newKeyName.trim(), scope: newKeyScope });
      setNewKeyName('');
      setNewKeyScope('read');
      setShowCreateForm(false);
    } catch {
      setCreateError(t('apiKeys.errors.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeConfirmed = async () => {
    if (!pendingRevokeId) return;
    setIsRevoking(true);
    setRevokeError(null);
    try {
      await revokeApiKey(pendingRevokeId);
      setPendingRevokeId(null);
    } catch {
      setRevokeError(t('apiKeys.errors.revokeError'));
    } finally {
      setIsRevoking(false);
    }
  };

  const cancelCreateForm = () => {
    setShowCreateForm(false);
    setCreateError(null);
    setNewKeyName('');
    setNewKeyScope('read');
  };

  // ── Active keys only ───────────────────────────────────────────────────────
  const activeKeys = keys.filter((k) => !k.revoked);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">

      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-border bg-surface-primary">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t('apiKeys.backToEditor')}</span>
        </Link>
        <span className="text-surface-border" aria-hidden="true">·</span>
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-blue-400" aria-hidden="true" />
          <h1 className="text-sm font-semibold text-text-primary">
            {t('apiKeys.pageTitle')}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Description */}
        <p className="text-sm text-text-muted leading-relaxed">
          {t('apiKeys.description')}
        </p>

        {/* Section header + actions */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            {t('apiKeys.sectionTitle')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchKeys()}
              disabled={isLoading}
              className="p-1.5 rounded text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
              aria-label={t('apiKeys.refresh')}
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              {t('apiKeys.generateButton')}
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="flex flex-col gap-3 p-4 rounded-lg border border-surface-border bg-surface-primary"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                {t('apiKeys.form.title')}
              </h3>
              <button
                type="button"
                onClick={cancelCreateForm}
                className="text-text-muted hover:text-text-primary transition-colors"
                aria-label={t('modals.common.cancel')}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="api-key-name" className="text-xs text-text-muted">
                {t('apiKeys.form.nameLabel')}
              </label>
              <input
                id="api-key-name"
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder={t('apiKeys.form.namePlaceholder')}
                maxLength={100}
                required
                autoFocus
                className="bg-surface-hover border border-surface-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="api-key-scope" className="text-xs text-text-muted">
                {t('apiKeys.form.scopeLabel')}
              </label>
              <select
                id="api-key-scope"
                value={newKeyScope}
                onChange={(e) => setNewKeyScope(e.target.value as ApiKeyScope)}
                className="bg-surface-hover border border-surface-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="read">
                  {t('apiKeys.scope.read')} — {t('apiKeys.scope.readDesc')}
                </option>
                <option value="write">
                  {t('apiKeys.scope.write')} — {t('apiKeys.scope.writeDesc')}
                </option>
              </select>
            </div>

            {createError && (
              <p className="text-xs text-red-400">{createError}</p>
            )}

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={cancelCreateForm}
                className="px-3 py-1.5 text-xs font-medium rounded text-text-muted hover:text-text-primary transition-colors"
              >
                {t('modals.common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isCreating || !newKeyName.trim()}
                className="px-4 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCreating ? t('apiKeys.form.generating') : t('apiKeys.form.generate')}
              </button>
            </div>
          </form>
        )}

        {/* Fetch error */}
        {error && (
          <p className="text-xs text-red-400">{t(`apiKeys.errors.${error}`)}</p>
        )}

        {/* Revoke error */}
        {revokeError && (
          <p className="text-xs text-red-400">{revokeError}</p>
        )}

        {/* Key list */}
        {isLoading && activeKeys.length === 0 ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-blue-500" />
          </div>
        ) : activeKeys.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <Key className="w-8 h-8 text-text-muted opacity-30" aria-hidden="true" />
            <p className="text-sm text-text-muted">{t('apiKeys.empty')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-surface-border overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_110px_110px_40px] gap-x-3 px-4 py-2 bg-surface-hover border-b border-surface-border text-xs font-medium text-text-muted">
              <span>{t('apiKeys.table.name')}</span>
              <span>{t('apiKeys.table.scope')}</span>
              <span>{t('apiKeys.table.created')}</span>
              <span>{t('apiKeys.table.lastUsed')}</span>
              <span />
            </div>

            {/* Rows */}
            {activeKeys.map((key) => (
              <div key={key.id} className="flex flex-col border-t border-surface-border">
                <div className="grid grid-cols-[1fr_80px_110px_110px_40px] items-center gap-x-3 px-4 py-3 hover:bg-surface-hover group transition-colors">
                  <span className="text-sm text-text-primary font-medium truncate">
                    {key.name}
                  </span>
                  <span className="text-xs font-mono text-text-muted bg-surface-hover border border-surface-border rounded px-1.5 py-0.5 w-fit">
                    {key.scope}
                  </span>
                  <span className="text-xs text-text-muted">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-xs text-text-muted">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString()
                      : t('apiKeys.table.never')}
                  </span>
                  <button
                    onClick={() => setPendingRevokeId(key.id)}
                    disabled={pendingRevokeId === key.id || isRevoking}
                    className="justify-self-center p-1 text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed focus:opacity-100"
                    aria-label={t('apiKeys.revokeAriaLabel', { name: key.name })}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                {/* Inline revoke confirmation */}
                {pendingRevokeId === key.id && (
                  <RevokeConfirm
                    keyName={key.name}
                    onConfirm={() => void handleRevokeConfirmed()}
                    onCancel={() => { setPendingRevokeId(null); setRevokeError(null); }}
                    isBusy={isRevoking}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* MCP integration hint */}
        <p className="text-xs text-text-muted border-t border-surface-border pt-4 leading-relaxed">
          {t('apiKeys.mcpHint')}
        </p>
      </div>

      {/* Show-once key dialog — rendered after successful creation */}
      {createdKey && (
        <ApiKeyCreatedDialog
          createdKey={createdKey}
          onClose={clearCreatedKey}
        />
      )}
    </div>
  );
}
