import { useState } from "react";
import { createPortal } from "react-dom";
import { X, FolderX } from "lucide-react";

const SUPPRESS_KEY = "libreuml-suppress-close-project-warning";

export function isCloseProjectWarningSuppressed(): boolean {
  try {
    return localStorage.getItem(SUPPRESS_KEY) === "1";
  } catch {
    return false;
  }
}

interface CloseProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function CloseProjectModal({
  isOpen,
  onClose,
  onConfirm,
}: CloseProjectModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleConfirm = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(SUPPRESS_KEY, "1");
      } catch {
        // storage unavailable — proceed anyway
      }
    }
    onConfirm();
    onClose();
  };

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
            <FolderX className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold text-[#e2e8f0]">Close Project</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#1e2738] rounded transition-colors"
          >
            <X className="w-4 h-4 text-[#94a3b8] hover:text-[#e2e8f0]" />
          </button>
        </div>

        <p className="text-sm text-[#94a3b8] mb-5 leading-relaxed">
          Unsaved changes will be lost. Are you sure you want to close the project?
        </p>

        <label className="flex items-center gap-2 mb-6 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="rounded border-[#2a3358] bg-[#0f1419] text-blue-500 focus:ring-blue-500"
          />
          <span className="text-xs text-[#64748b]">Don&apos;t show this again</span>
        </label>

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
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Close Project
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
