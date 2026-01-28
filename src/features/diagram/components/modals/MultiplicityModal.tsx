import { useState, useEffect } from "react";
import { X, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

interface MultiplicityModalProps {
  isOpen: boolean;
  initialSource: string;
  initialTarget: string;
  onClose: () => void;
  onSave: (source: string, target: string) => void;
}

const PREDEFINED_OPTIONS = ["0..1", "1", "0..*", "1..*", "*"];

export default function MultiplicityModal({
  isOpen,
  initialSource,
  initialTarget,
  onClose,
  onSave,
}: MultiplicityModalProps) {
  const { t } = useTranslation();
  const [source, setSource] = useState(initialSource);
  const [target, setTarget] = useState(initialTarget);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSource(initialSource);
      setTarget(initialTarget);
    }
  }, [isOpen, initialSource, initialTarget]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(source, target);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-primary border border-surface-border rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="px-4 py-3 border-b border-surface-border flex justify-between items-center bg-surface-secondary/50">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wide">
            {t("modals.multiplicity.title")} 
          </h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 grid grid-cols-2 gap-6">
          
          {/* SOURCE COLUMN */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 mb-1">
              <ArrowLeft className="w-3 h-3" />
              {t("modals.multiplicity.source")}
            </div>
            
            <input
              type="text"
              value={source}
              readOnly
              placeholder="Select..."
              className="w-full bg-surface-secondary border border-surface-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none cursor-default font-mono text-center"
            />

            <div className="flex flex-wrap gap-1.5 justify-center">
              {PREDEFINED_OPTIONS.map((opt) => (
                <button
                  key={`src-${opt}`}
                  onClick={() => setSource(opt)}
                  className={`text-[10px] px-2 py-1 rounded border transition-all
                    ${source === opt 
                      ? "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-500 text-indigo-600 dark:text-indigo-300 font-bold scale-105" 
                      : "bg-surface-primary border-surface-border text-text-secondary hover:border-text-primary hover:bg-surface-hover"
                    }`}
                >
                  {opt}
                </button>
              ))}
               <button
                 onClick={() => setSource("")}
                 className="text-[10px] px-2 py-1 rounded border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                {t("modals.common.clear")}
              </button>
            </div>
          </div>

          {/* TARGET COLUMN */}
          <div className="flex flex-col gap-3 border-l border-surface-border/50 pl-6">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 mb-1">
              {t("modals.multiplicity.target")}
              <ArrowRight className="w-3 h-3" />
            </div>

            <input
              type="text"
              value={target}
              readOnly
              placeholder="Select..."
              className="w-full bg-surface-secondary border border-surface-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none cursor-default font-mono text-center"
            />

            <div className="flex flex-wrap gap-1.5 justify-center">
              {PREDEFINED_OPTIONS.map((opt) => (
                <button
                  key={`tgt-${opt}`}
                  onClick={() => setTarget(opt)}
                  className={`text-[10px] px-2 py-1 rounded border transition-all
                    ${target === opt 
                      ? "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-500 text-indigo-600 dark:text-indigo-300 font-bold scale-105" 
                      : "bg-surface-primary border-surface-border text-text-secondary hover:border-text-primary hover:bg-surface-hover"
                    }`}
                >
                  {opt}
                </button>
              ))}
               <button
                 onClick={() => setTarget("")}
                 className="text-[10px] px-2 py-1 rounded border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                {t("modals.common.clear")}
              </button>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="px-4 py-3 bg-surface-secondary/30 border-t border-surface-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            {t("modals.common.cancel")}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-uml-class-border text-white text-xs font-bold rounded shadow-sm hover:brightness-110 transition-all active:scale-95"
          >
            <Check className="w-3 h-3" />
            {t("modals.common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}