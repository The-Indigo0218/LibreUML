import { createPortal } from "react-dom";
import { X, FileText } from "lucide-react";

interface ViewDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeName: string;
  description: string;
}

export default function ViewDescriptionModal({
  isOpen,
  onClose,
  nodeName,
  description,
}: ViewDescriptionModalProps) {
  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-[#161d2f] border border-surface-border shadow-2xl rounded-lg w-full max-w-md relative z-[10000] p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-text-muted" />
            <h2 className="text-xl font-semibold text-text-primary">{nodeName}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded transition-colors"
          >
            <X className="w-5 h-5 text-text-muted hover:text-text-primary" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Description
            </label>
            {description ? (
              <div className="px-3 py-2 bg-surface-primary border border-surface-border rounded-lg text-text-primary text-sm whitespace-pre-wrap">
                {description}
              </div>
            ) : (
              <div className="px-3 py-2 bg-surface-primary border border-surface-border rounded-lg text-text-muted text-sm italic">
                No description provided
              </div>
            )}
          </div>

          <div className="flex items-center justify-end pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-hover hover:bg-surface-border hover:text-text-primary rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
