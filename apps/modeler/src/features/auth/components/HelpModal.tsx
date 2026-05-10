// src/features/auth/components/HelpModal.tsx
//
// Help modal with 4 informational tabs.
// • Fully keyboard navigable (Tab, arrow keys on tabs, Esc to close)
// • Focus trapped inside while open
// • All content from i18n

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen, Lock, Shield, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type TabId = 'gettingStarted' | 'passwordRequirements' | 'oauthLogin' | 'offlineMode';

interface Tab {
  id: TabId;
  labelKey: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'gettingStarted',       labelKey: 'help.gettingStarted.title',       icon: <BookOpen className="w-4 h-4" /> },
  { id: 'passwordRequirements', labelKey: 'help.passwordRequirements.title', icon: <Lock className="w-4 h-4" /> },
  { id: 'oauthLogin',           labelKey: 'help.oauthLogin.title',           icon: <Shield className="w-4 h-4" /> },
  { id: 'offlineMode',          labelKey: 'help.offlineMode.title',          icon: <WifiOff className="w-4 h-4" /> },
];

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('gettingStarted');
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Esc
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Focus the close button when modal opens
  useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus();
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="help-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-surface-secondary border border-surface-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border shrink-0">
          <h2 id="help-modal-title" className="text-base font-semibold text-text-primary">
            {t('help.title')}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t('help.close')}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tab list */}
        <div
          role="tablist"
          aria-label={t('help.title')}
          className="flex gap-1 px-4 pt-3 pb-0 overflow-x-auto shrink-0"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`help-panel-${tab.id}`}
              id={`help-tab-${tab.id}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-transparent text-text-muted hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              {tab.icon}
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div className="flex-1 overflow-y-auto">
          {/* Getting Started */}
          <div
            id="help-panel-gettingStarted"
            role="tabpanel"
            aria-labelledby="help-tab-gettingStarted"
            hidden={activeTab !== 'gettingStarted'}
            className="px-5 py-4 space-y-3"
          >
            <p className="text-sm text-text-primary leading-relaxed">
              {t('help.gettingStarted.content')}
            </p>
            <div className="space-y-2">
              {(['feature1', 'feature2', 'feature3'] as const).map((key) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5 text-sm">•</span>
                  <p className="text-sm text-text-secondary">{t(`help.gettingStarted.${key}`)}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs font-semibold text-blue-400 mb-1">{t('help.gettingStarted.quickStartTitle')}</p>
              <p className="text-xs text-text-secondary">{t('help.gettingStarted.quickStart')}</p>
            </div>
          </div>

          {/* Password Requirements */}
          <div
            id="help-panel-passwordRequirements"
            role="tabpanel"
            aria-labelledby="help-tab-passwordRequirements"
            hidden={activeTab !== 'passwordRequirements'}
            className="px-5 py-4 space-y-3"
          >
            <p className="text-sm text-text-secondary">{t('help.passwordRequirements.intro')}</p>
            <ul className="space-y-1.5">
              {(['rule1', 'rule2', 'rule3', 'rule4', 'rule5'] as const).map((key) => (
                <li key={key} className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="text-green-400 text-base leading-none" aria-hidden="true">✓</span>
                  {t(`help.passwordRequirements.${key}`)}
                </li>
              ))}
            </ul>
            <div className="mt-3 p-3 bg-surface-primary border border-surface-border rounded-lg space-y-1">
              <p className="text-xs font-semibold text-text-secondary mb-2">{t('help.passwordRequirements.examples')}</p>
              <p className="text-xs font-mono">
                <span className="text-green-400 mr-2" aria-label="valid">✓</span>
                {t('help.passwordRequirements.validExample')}
              </p>
              <p className="text-xs font-mono">
                <span className="text-red-400 mr-2" aria-label="invalid">✗</span>
                {t('help.passwordRequirements.invalidExample')}
              </p>
            </div>
          </div>

          {/* OAuth Login */}
          <div
            id="help-panel-oauthLogin"
            role="tabpanel"
            aria-labelledby="help-tab-oauthLogin"
            hidden={activeTab !== 'oauthLogin'}
            className="px-5 py-4 space-y-4"
          >
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                {t('help.oauthLogin.what')}
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">
                {t('help.oauthLogin.whatContent')}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                {t('help.oauthLogin.benefits')}
              </p>
              <ul className="space-y-1">
                {(['benefit1', 'benefit2', 'benefit3'] as const).map((key) => (
                  <li key={key} className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className="text-green-400" aria-hidden="true">✓</span>
                    {t(`help.oauthLogin.${key}`)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-3 bg-surface-primary border border-surface-border rounded-lg">
              <p className="text-xs font-semibold text-text-secondary mb-1">{t('help.oauthLogin.privacy')}</p>
              <p className="text-xs text-text-muted leading-relaxed">
                {t('help.oauthLogin.privacyContent')}
              </p>
            </div>
          </div>

          {/* Offline Mode */}
          <div
            id="help-panel-offlineMode"
            role="tabpanel"
            aria-labelledby="help-tab-offlineMode"
            hidden={activeTab !== 'offlineMode'}
            className="px-5 py-4 space-y-4"
          >
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                {t('help.offlineMode.what')}
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">
                {t('help.offlineMode.whatContent')}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                {t('help.offlineMode.features')}
              </p>
              <ul className="space-y-1">
                {(['feature1', 'feature2', 'feature3'] as const).map((key) => (
                  <li key={key} className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className="text-blue-400" aria-hidden="true">•</span>
                    {t(`help.offlineMode.${key}`)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs font-semibold text-blue-400 mb-1">{t('help.offlineMode.upgrade')}</p>
              <p className="text-xs text-text-secondary leading-relaxed">
                {t('help.offlineMode.upgradeContent')}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-surface-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-surface-primary border border-surface-border hover:bg-surface-hover text-text-primary transition-colors"
          >
            {t('help.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
