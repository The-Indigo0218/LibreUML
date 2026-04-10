import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Bell, BellOff, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../../store/settingsStore';

interface ModalPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ModalPreference {
  id: string;
  label: string;
  description: string;
  isEnabled: boolean;
  toggle: () => void;
}

export default function ModalPreferencesModal({
  isOpen,
  onClose,
}: ModalPreferencesModalProps) {
  const { t } = useTranslation();
  
  const suppressSvgWarning = useSettingsStore((s) => s.suppressSvgWarning);
  const setSuppressSvgWarning = useSettingsStore((s) => s.setSuppressSvgWarning);
  const hideDuplicateFileWarning = useSettingsStore((s) => s.hideDuplicateFileWarning);
  const setHideDuplicateFileWarning = useSettingsStore((s) => s.setHideDuplicateFileWarning);
  const resetAllModalPreferences = useSettingsStore((s) => s.resetAllModalPreferences);

  // Track localStorage-based preferences
  const [closeProjectWarning, setCloseProjectWarning] = useState(true);
  const [autoLayoutWarning, setAutoLayoutWarning] = useState(true);

  // Load localStorage preferences on mount
  useEffect(() => {
    if (!isOpen) return;
    
    try {
      const closeProjectSuppressed = localStorage.getItem('libreuml-suppress-close-project-warning') === '1';
      const autoLayoutSuppressed = localStorage.getItem('libreuml-auto-layout-locked-warning') === 'true';
      
      setCloseProjectWarning(!closeProjectSuppressed);
      setAutoLayoutWarning(!autoLayoutSuppressed);
    } catch (e) {
      console.error('Failed to load modal preferences:', e);
    }
  }, [isOpen]);

  const modalPreferences: ModalPreference[] = [
    {
      id: 'svg-export',
      label: t('modals.preferences.svgExportWarning') || 'SVG Export Warning',
      description: t('modals.preferences.svgExportDesc') || 'Show warning when exporting to SVG format',
      isEnabled: !suppressSvgWarning,
      toggle: () => setSuppressSvgWarning(!suppressSvgWarning),
    },
    {
      id: 'duplicate-file',
      label: t('modals.preferences.duplicateFileWarning') || 'Duplicate File Warning',
      description: t('modals.preferences.duplicateFileDesc') || 'Show warning when adding existing file to diagram',
      isEnabled: !hideDuplicateFileWarning,
      toggle: () => setHideDuplicateFileWarning(!hideDuplicateFileWarning),
    },
    {
      id: 'close-project',
      label: t('modals.preferences.closeProjectWarning') || 'Close Project Warning',
      description: t('modals.preferences.closeProjectDesc') || 'Show confirmation when closing a project',
      isEnabled: closeProjectWarning,
      toggle: () => {
        try {
          if (closeProjectWarning) {
            localStorage.setItem('libreuml-suppress-close-project-warning', '1');
          } else {
            localStorage.removeItem('libreuml-suppress-close-project-warning');
          }
          setCloseProjectWarning(!closeProjectWarning);
        } catch (e) {
          console.error('Failed to toggle close project warning:', e);
        }
      },
    },
    {
      id: 'auto-layout',
      label: t('modals.preferences.autoLayoutWarning') || 'Auto-Layout Warning',
      description: t('modals.preferences.autoLayoutDesc') || 'Show warning before running auto-layout on locked nodes',
      isEnabled: autoLayoutWarning,
      toggle: () => {
        try {
          if (autoLayoutWarning) {
            localStorage.setItem('libreuml-auto-layout-locked-warning', 'true');
          } else {
            localStorage.removeItem('libreuml-auto-layout-locked-warning');
          }
          setAutoLayoutWarning(!autoLayoutWarning);
        } catch (e) {
          console.error('Failed to toggle auto-layout warning:', e);
        }
      },
    },
  ];

  const handleResetAll = () => {
    resetAllModalPreferences();
    setCloseProjectWarning(true);
    setAutoLayoutWarning(true);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-[600px] max-w-full m-4 max-h-[80vh] flex flex-col transform scale-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-400/10 rounded-full">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-text-primary">
              {t('modals.preferences.title') || 'Modal Preferences'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-text-secondary mb-6">
            {t('modals.preferences.description') || 
              'Control which warning and confirmation modals are shown. Disabled modals will not appear again.'}
          </p>

          <div className="space-y-4">
            {modalPreferences.map((pref) => (
              <div
                key={pref.id}
                className="flex items-start justify-between p-4 bg-surface-secondary border border-surface-border rounded-lg hover:border-accent-primary/30 transition-colors"
              >
                <div className="flex-1 mr-4">
                  <div className="flex items-center gap-2 mb-1">
                    {pref.isEnabled ? (
                      <Bell className="w-4 h-4 text-green-400" />
                    ) : (
                      <BellOff className="w-4 h-4 text-text-muted" />
                    )}
                    <h3 className="text-sm font-semibold text-text-primary">
                      {pref.label}
                    </h3>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {pref.description}
                  </p>
                </div>
                <button
                  onClick={pref.toggle}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${pref.isEnabled ? 'bg-green-500' : 'bg-surface-border'}
                  `}
                  role="switch"
                  aria-checked={pref.isEnabled}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${pref.isEnabled ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            ))}
          </div>

          {/* Reset All Button */}
          <div className="mt-6 p-4 bg-amber-400/10 border border-amber-400/30 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1 mr-4">
                <h3 className="text-sm font-semibold text-amber-400 mb-1">
                  {t('modals.preferences.resetAll') || 'Reset All Preferences'}
                </h3>
                <p className="text-xs text-text-secondary">
                  {t('modals.preferences.resetAllDesc') || 
                    'Re-enable all warning and confirmation modals'}
                </p>
              </div>
              <button
                onClick={handleResetAll}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 rounded-md transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {t('modals.preferences.reset') || 'Reset'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-surface-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md shadow-lg shadow-blue-500/20 transition-all"
          >
            {t('modals.preferences.close') || 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
