import { useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, FolderPlus, HelpCircle, CheckCircle2 } from "lucide-react";
import { addStandaloneToProject } from "../../actions/addStandaloneToProject";

export interface StandaloneFileRef {
  id: string;
  name: string;
}

interface SaveProjectWarningModalProps {
  isOpen: boolean;
  standaloneFiles: StandaloneFileRef[];
  onClose: () => void;
  onConfirm: () => void;
}

export default function SaveProjectWarningModal({
  isOpen,
  standaloneFiles,
  onClose,
  onConfirm,
}: SaveProjectWarningModalProps) {
  const [showWhy, setShowWhy] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  if (!isOpen) return null;

  // Once every standalone has been folded in, there's nothing to exclude — the
  // warning becomes a clean "ready to save" confirmation.
  const allClear = standaloneFiles.length === 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-[#161d2f] border border-[#2a3358] shadow-2xl rounded-lg w-full max-w-md relative z-[10000] p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {allClear ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <h2 className="text-base font-semibold text-[#e2e8f0]">
              {allClear ? "Ready to Save" : "Standalone Files Excluded"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#1e2738] rounded transition-colors"
          >
            <X className="w-4 h-4 text-[#94a3b8] hover:text-[#e2e8f0]" />
          </button>
        </div>

        {allClear ? (
          <p className="text-sm text-[#94a3b8] mb-5 leading-relaxed">
            All standalone files have been added to the project. Everything will
            be included in the saved package.
          </p>
        ) : (
          <>
            <p className="text-sm text-[#94a3b8] mb-2 leading-relaxed">
              These files are standalone, so they will{" "}
              <span className="text-amber-400 font-medium">NOT</span> be saved in
              the project package. Add them to the project to include them, or
              export each one individually as a{" "}
              <code className="text-[#7C83FF]">.luml</code> file.
            </p>

            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors mb-3"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {showWhy ? "Hide details" : "What is a standalone file?"}
            </button>

            {showWhy && (
              <div className="mb-4 p-3 rounded-md bg-[#0d1117] border border-[#1e2738] text-xs text-[#94a3b8] leading-relaxed space-y-2">
                <p>
                  A <span className="text-[#cbd5e1] font-medium">standalone</span>{" "}
                  diagram is isolated from the shared project model: it keeps its
                  own private elements instead of drawing from the project's
                  workspace.
                </p>
                <p>
                  Because the project package (
                  <code className="text-[#7C83FF]">.luml.zip</code>) only exports
                  the shared model, standalone diagrams are left out.{" "}
                  <span className="text-[#cbd5e1]">Add to Project</span> merges a
                  diagram's private elements back into the shared model so it
                  saves with everything else.
                </p>
              </div>
            )}

            <ul className="mb-5 space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
              {standaloneFiles.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-2 text-xs text-[#cbd5e1] group"
                >
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                  <span className="truncate flex-1">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => addStandaloneToProject(file.id)}
                    className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors opacity-80 group-hover:opacity-100"
                  >
                    <FolderPlus className="w-3 h-3" />
                    Add to Project
                  </button>
                </li>
              ))}
            </ul>
          </>
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
            {allClear ? "Save Project" : "Save Project Anyway"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
