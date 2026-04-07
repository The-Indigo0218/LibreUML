import { Sparkles, PlusCircle, LayoutTemplate } from "lucide-react";
import { useTranslation } from "react-i18next";

interface EmptyStateOverlayProps {
  onStartFromScratch: () => void;
  onLoadTemplate: () => void;
}

export function EmptyStateOverlay({ onStartFromScratch, onLoadTemplate }: EmptyStateOverlayProps) {
  const { t } = useTranslation();

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-surface-primary/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 max-w-lg w-full px-8 py-10 text-center">

        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20">
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">
            {t("emptyState.welcome")}
          </h2>
          <p className="text-sm text-text-muted max-w-xs">
            {t("emptyState.subtitle")}
          </p>
        </div>

        <iframe
          width="480"
          height="270"
          src=""
          title="LibreUML Tutorial"
          className="bg-surface-secondary border border-surface-border rounded-xl shadow-lg animate-pulse w-full"
          allowFullScreen
        />

        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
          <button
            onClick={onStartFromScratch}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface-secondary border border-surface-border text-text-primary text-sm font-medium hover:bg-surface-hover transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            {t("emptyState.startFromScratch")}
          </button>

          <button
            onClick={onLoadTemplate}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <LayoutTemplate className="w-4 h-4" />
            {t("emptyState.loadHospital")}
          </button>
        </div>

        <p className="text-xs text-text-muted">
          {t("emptyState.hint")}
        </p>
      </div>
    </div>
  );
}
