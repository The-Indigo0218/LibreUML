import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useKonvaAutoLayout, LOCKED_WARNING_KEY } from '../../../../canvas/hooks/useKonvaAutoLayout';

export function AutoLayoutLockedWarningModal() {
  const activeModal = useUiStore((s) => s.activeModal);
  const closeModals = useUiStore((s) => s.closeModals);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { executeLayout } = useKonvaAutoLayout();

  if (activeModal !== 'auto-layout-locked-warning') return null;

  const handleProceed = () => {
    if (dontShowAgain) {
      localStorage.setItem(LOCKED_WARNING_KEY, 'true');
    }
    executeLayout();
    closeModals();
  };

  const handleCancel = () => {
    setDontShowAgain(false);
    closeModals();
  };

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary mb-1">
              Locked Edges Detected
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              This diagram has locked edges. Auto Layout will reposition all nodes but
              will not move locked connections, which may result in an uneven layout.
              Do you want to proceed?
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 mb-6 cursor-pointer group">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-4 h-4 rounded border-surface-border bg-surface-secondary accent-indigo-500 cursor-pointer"
          />
          <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors select-none">
            Don't show this warning again
          </span>
        </label>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-secondary hover:bg-surface-border rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleProceed}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            Proceed
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
