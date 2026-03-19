import { createPortal } from 'react-dom';
import { X, Keyboard, Command } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  descriptionKey: string;
}

interface ShortcutCategory {
  titleKey: string;
  shortcuts: Shortcut[];
}

// ─── Detect OS for Cmd vs Ctrl ───────────────────────────────────────────────

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories: ShortcutCategory[] = [
    {
      titleKey: 'keyboardShortcuts.categories.general',
      shortcuts: [
        { keys: [modKey, 'O'], descriptionKey: 'keyboardShortcuts.shortcuts.openFile' },
        { keys: [modKey, 'S'], descriptionKey: 'keyboardShortcuts.shortcuts.save' },
        { keys: [modKey, 'K'], descriptionKey: 'keyboardShortcuts.shortcuts.spotlight' },
        { keys: [modKey, 'Z'], descriptionKey: 'keyboardShortcuts.shortcuts.undo' },
        { keys: [modKey, 'Y'], descriptionKey: 'keyboardShortcuts.shortcuts.redo' },
      ],
    },
    {
      titleKey: 'keyboardShortcuts.categories.canvas',
      shortcuts: [
        { keys: [modKey, 'L'], descriptionKey: 'keyboardShortcuts.shortcuts.magicLayout' },
        { keys: [modKey, 'G'], descriptionKey: 'keyboardShortcuts.shortcuts.generateCode' },
        { keys: [modKey, '+'], descriptionKey: 'keyboardShortcuts.shortcuts.zoomIn' },
        { keys: [modKey, '-'], descriptionKey: 'keyboardShortcuts.shortcuts.zoomOut' },
        { keys: [modKey, '0'], descriptionKey: 'keyboardShortcuts.shortcuts.fitView' },
        { keys: ['Delete'], descriptionKey: 'keyboardShortcuts.shortcuts.delete' },
      ],
    },
    {
      titleKey: 'keyboardShortcuts.categories.terminal',
      shortcuts: [
        { keys: ['↑'], descriptionKey: 'keyboardShortcuts.shortcuts.commandHistoryUp' },
        { keys: ['↓'], descriptionKey: 'keyboardShortcuts.shortcuts.commandHistoryDown' },
        { keys: ['Tab'], descriptionKey: 'keyboardShortcuts.shortcuts.autocomplete' },
        { keys: [modKey, 'C'], descriptionKey: 'keyboardShortcuts.shortcuts.clearInput' },
      ],
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Keyboard className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                {t('keyboardShortcuts.title')}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {t('keyboardShortcuts.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-text-muted hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Content ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {categories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="space-y-3">
                {/* Category Title */}
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                  <Command className="w-3.5 h-3.5" />
                  {t(category.titleKey)}
                </h3>

                {/* Shortcuts List */}
                <div className="bg-surface-secondary border border-surface-border rounded-lg p-3 space-y-2">
                  {category.shortcuts.map((shortcut, shortcutIndex) => (
                    <div
                      key={shortcutIndex}
                      className="flex items-center justify-between py-2 px-2 rounded hover:bg-surface-hover transition-colors group"
                    >
                      {/* Description */}
                      <span className="text-sm text-text-primary group-hover:text-text-primary">
                        {t(shortcut.descriptionKey)}
                      </span>

                      {/* Keys */}
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <kbd
                            key={keyIndex}
                            className="px-2 py-1 text-xs font-mono font-semibold bg-surface-primary border border-surface-border rounded shadow-sm text-text-primary min-w-[28px] text-center"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── Footer Note ────────────────────────────────────────────── */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-xs text-text-muted text-center">
              {t('keyboardShortcuts.footerNote')}
            </p>
          </div>
        </div>

        {/* ── Footer Button ──────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-surface-border flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {t('keyboardShortcuts.actions.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
