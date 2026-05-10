import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface DuplicateFileModalProps {
  isOpen: boolean;
  fileName: string;
  onReplace: () => void;
  onCancel: () => void;
  onDontShowAgain: (checked: boolean) => void;
}

export default function DuplicateFileModal({
  isOpen,
  fileName,
  onReplace,
  onCancel,
  onDontShowAgain,
}: DuplicateFileModalProps) {
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleReplace = () => {
    if (dontShowAgain) {
      onDontShowAgain(true);
    }
    onReplace();
  };

  const handleCancel = () => {
    if (dontShowAgain) {
      onDontShowAgain(true);
    }
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-primary border border-surface-border p-6 rounded-xl shadow-2xl w-[480px] max-w-full m-4 transform scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4 text-amber-400">
          <div className="p-2 bg-amber-400/10 rounded-full">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-text-primary">
            {t("modals.duplicateFile.title")}
          </h3>
        </div>

        <p className="text-text-secondary text-sm mb-4 leading-relaxed">
          {t("modals.duplicateFile.message", { fileName })}
        </p>

        <div className="bg-surface-secondary border border-surface-border rounded-lg p-3 mb-4">
          <p className="text-text-secondary text-xs leading-relaxed">
            <span className="font-semibold text-text-primary">
              {t("modals.duplicateFile.replaceOption")}:
            </span>{" "}
            {t("modals.duplicateFile.replaceDescription")}
          </p>
          <p className="text-text-secondary text-xs leading-relaxed mt-2">
            <span className="font-semibold text-text-primary">
              {t("modals.duplicateFile.cancelOption")}:
            </span>{" "}
            {t("modals.duplicateFile.cancelDescription")}
          </p>
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-surface-border bg-surface-secondary text-accent-primary focus:ring-2 focus:ring-accent-primary/50 cursor-pointer"
            />
            <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
              {t("modals.duplicateFile.dontShowAgain")}
            </span>
          </label>
          {dontShowAgain && (
            <p className="text-xs text-amber-400 mt-2 ml-6">
              {t("modals.duplicateFile.reEnableHint")}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors"
          >
            {t("modals.duplicateFile.cancel")}
          </button>
          <button
            onClick={handleReplace}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-md shadow-lg shadow-amber-500/20 transition-all"
          >
            {t("modals.duplicateFile.replace")}
          </button>
        </div>
      </div>
    </div>
  );
}
