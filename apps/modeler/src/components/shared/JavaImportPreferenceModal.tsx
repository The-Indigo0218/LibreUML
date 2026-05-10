import { useState } from "react";
import { X, FileCode, Database, Layout } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  isOpen: boolean;
  fileName: string;
  onImportToModel: () => void;
  onImportToCanvas: () => void;
  onImportToBoth: () => void;
  onCancel: () => void;
  onDontShowAgain: (preference: 'model' | 'canvas' | 'both' | null) => void;
}

export default function JavaImportPreferenceModal({
  isOpen,
  fileName,
  onImportToModel,
  onImportToCanvas,
  onImportToBoth,
  onCancel,
  onDontShowAgain,
}: Props) {
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'model' | 'canvas' | 'both' | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (dontShowAgain && selectedOption) {
      onDontShowAgain(selectedOption);
    }

    switch (selectedOption) {
      case 'model':
        onImportToModel();
        break;
      case 'canvas':
        onImportToCanvas();
        break;
      case 'both':
        onImportToBoth();
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-140 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border bg-surface-secondary/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-text-primary">{t("modals.javaImportPreference.title")}</h3>
              <p className="text-xs text-text-muted">{fileName}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-text-secondary mb-4">
            {t("modals.javaImportPreference.question")}
          </p>

          {/* Option 1: Model (SSOT) */}
          <button
            onClick={() => setSelectedOption('model')}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              selectedOption === 'model'
                ? 'border-green-500 bg-green-500/10'
                : 'border-surface-border hover:border-surface-border-hover bg-surface-secondary/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                selectedOption === 'model' ? 'bg-green-500/20 text-green-400' : 'bg-surface-secondary text-text-muted'
              }`}>
                <Database className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-text-primary mb-1">
                  {t("modals.javaImportPreference.toModel")}
                </h4>
                <p className="text-xs text-text-muted">
                  {t("modals.javaImportPreference.toModelDesc")}
                </p>
              </div>
            </div>
          </button>

          {/* Option 2: Current Canvas */}
          <button
            onClick={() => setSelectedOption('canvas')}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              selectedOption === 'canvas'
                ? 'border-green-500 bg-green-500/10'
                : 'border-surface-border hover:border-surface-border-hover bg-surface-secondary/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                selectedOption === 'canvas' ? 'bg-green-500/20 text-green-400' : 'bg-surface-secondary text-text-muted'
              }`}>
                <Layout className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-text-primary mb-1">
                  {t("modals.javaImportPreference.toCanvas")}
                </h4>
                <p className="text-xs text-text-muted">
                  {t("modals.javaImportPreference.toCanvasDesc")}
                </p>
              </div>
            </div>
          </button>

          {/* Option 3: Both */}
          <button
            onClick={() => setSelectedOption('both')}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              selectedOption === 'both'
                ? 'border-green-500 bg-green-500/10'
                : 'border-surface-border hover:border-surface-border-hover bg-surface-secondary/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                selectedOption === 'both' ? 'bg-green-500/20 text-green-400' : 'bg-surface-secondary text-text-muted'
              }`}>
                <FileCode className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-text-primary mb-1">
                  {t("modals.javaImportPreference.toBoth")}
                </h4>
                <p className="text-xs text-text-muted">
                  {t("modals.javaImportPreference.toBothDesc")}
                </p>
              </div>
            </div>
          </button>

          {/* Don't show again checkbox */}
          <div className="pt-4 border-t border-surface-border">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-surface-border bg-surface-secondary checked:bg-green-500 checked:border-green-500 cursor-pointer"
              />
              <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                {t("modals.javaImportPreference.dontShowAgain")}
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-border bg-surface-secondary/50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            {t("modals.javaImportPreference.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedOption}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-500 font-medium shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("modals.javaImportPreference.import")}
          </button>
        </div>
      </div>
    </div>
  );
}
