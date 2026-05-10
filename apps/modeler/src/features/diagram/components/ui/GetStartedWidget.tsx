import { X, Sparkles, PlusCircle, LayoutTemplate } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../../../../store/uiStore";

interface GetStartedWidgetProps {
  onLoadTemplate: () => void;
}

export function GetStartedWidget({ onLoadTemplate }: GetStartedWidgetProps) {
  const { t } = useTranslation();
  const closeGetStarted = useUiStore((s) => s.closeGetStarted);

  const handleLoadTemplate = () => {
    onLoadTemplate();
    closeGetStarted();
  };

  return (
    <div className="absolute bottom-4 right-4 z-50 w-80 bg-surface-primary border border-surface-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className="text-sm font-bold text-text-primary">
            {t("emptyState.welcome")}
          </h3>
        </div>
        <button
          onClick={closeGetStarted}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 p-4">
        <p className="text-xs text-text-muted leading-relaxed">
          {t("emptyState.subtitle")}
        </p>

        {/* Video placeholder */}
        <iframe
          width="100%"
          height="158"
          src=""
          title="LibreUML Tutorial"
          className="rounded-lg border border-surface-border bg-surface-secondary animate-pulse"
          allowFullScreen
        />

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={closeGetStarted}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-secondary border border-surface-border text-text-primary text-xs font-medium hover:bg-surface-hover transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {t("emptyState.startFromScratch")}
          </button>

          <button
            onClick={handleLoadTemplate}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors shadow-sm"
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            {t("emptyState.loadHospital")}
          </button>
        </div>

        <p className="text-[10px] text-text-muted text-center">
          {t("emptyState.hint")}
        </p>
      </div>
    </div>
  );
}
