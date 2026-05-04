import { createPortal } from "react-dom";
import { X, AlertTriangle } from "lucide-react";

interface SaveProjectWarningModalProps {
  isOpen: boolean;
  standaloneFileNames: string[];
  onClose: () => void;
  onConfirm: () => void;
}

export default function SaveProjectWarningModal({
  isOpen,
  standaloneFileNames,
  onClose,
  onConfirm,
}: SaveProjectWarningModalProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-[#161d2f] border border-[#2a3358] shadow-2xl rounded-lg w-full max-w-sm relative z-[10000] p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 className="text-base font-semibold text-[#e2e8f0]">
              Standalone Files Excluded
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#1e2738] rounded transition-colors"
          >
            <X className="w-4 h-4 text-[#94a3b8] hover:text-[#e2e8f0]" />
          </button>
        </div>

        <p className="text-sm text-[#94a3b8] mb-3 leading-relaxed">
          Your workspace contains standalone files. Because they are isolated,
          they will <span className="text-amber-400 font-medium">NOT</span> be
          saved in the project package. If you want to keep them, please export
          them individually as <code className="text-[#7C83FF]">.luml</code> files.
        </p>

        {standaloneFileNames.length > 0 && (
          <ul className="mb-5 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
            {standaloneFileNames.map((name) => (
              <li
                key={name}
                className="flex items-center gap-2 text-xs text-[#64748b]"
              >
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                {name}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#cbd5e1] bg-[#1e2738] hover:bg-[#2a3358] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onClose(); }}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            Save Project Anyway
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
