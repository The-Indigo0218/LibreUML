import { useState, useEffect, useCallback } from "react";
import {
  Download,
  Image as ImageIcon,
  FileCode,
  Network,
  AlertTriangle,
  Timer,
  ArrowRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useReactFlow } from "reactflow";
import { useDiagramStore } from "../../../../store/diagramStore";
import { useSettingsStore } from "../../../../store/settingsStore";
import { ExportService } from "../../../../services/export.service";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { t } = useTranslation();
  const { getNodes } = useReactFlow();

  // Stores
  const diagramName = useDiagramStore((s) => s.diagramName);
  const showAllEdges = useDiagramStore((s) => s.showAllEdges);
  const toggleShowAllEdges = useDiagramStore((s) => s.toggleShowAllEdges);

  const suppressSvgWarning = useSettingsStore((s) => s.suppressSvgWarning);
  const setSuppressSvgWarning = useSettingsStore(
    (s) => s.setSuppressSvgWarning,
  );

  // Local State
  const [format, setFormat] = useState<"png" | "svg">("png");
  const [scale, setScale] = useState<number>(2);
  const [transparent, setTransparent] = useState(false);
  const [includeConnections, setIncludeConnections] = useState(false);

  const [isExporting, setIsExporting] = useState(false);

  // Warning Flow State
  const [view, setView] = useState<"config" | "warning">("config");
  const [countdown, setCountdown] = useState(3);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView("config");
      setCountdown(3);
      setDontShowAgain(false);
      setIncludeConnections(showAllEdges ?? false);
    }
  }, [isOpen, showAllEdges]);

  // Countdown (3 segundos)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (view === "warning" && countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [view, countdown]);

  // --- CORE EXPORT LOGIC ---
  const executeExport = useCallback(async () => {
    setIsExporting(true);
    const viewportEl = document.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement;

    if (!viewportEl) {
      setIsExporting(false);
      return;
    }

    const computedStyle = getComputedStyle(document.documentElement);
    const bgColor = computedStyle.getPropertyValue("--canvas-base").trim();

    //  VISUAL STATE FUNCTION (SNAPSHOT)
    const originalShowEdgesState = useDiagramStore.getState().showAllEdges;
    let stateChanged = false;

    if (includeConnections && !originalShowEdgesState) {
      toggleShowAllEdges();
      stateChanged = true;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    try {
      await ExportService.downloadImage(viewportEl, getNodes(), {
        fileName: diagramName || "diagram",
        format,
        scale,
        transparent,
        backgroundColor: bgColor,
      });

      if (format === "svg" && dontShowAgain) {
        setSuppressSvgWarning(true);
      }

      onClose();
    } catch (error) {
      alert(
        t("alerts.exportError") ||
          "Error exporting image" +
            (error instanceof Error ? `: ${error.message}` : ""),
      );
    } finally {
      if (stateChanged) {
        toggleShowAllEdges();
      }
      setIsExporting(false);
    }
  }, [
    diagramName,
    format,
    scale,
    transparent,
    includeConnections,
    toggleShowAllEdges,
    getNodes,
    onClose,
    t,
    dontShowAgain,
    setSuppressSvgWarning,
  ]);

  // --- HANDLERS ---
  const handleExportClick = () => {
    if (format === "svg" && !suppressSvgWarning) {
      setView("warning");
      setCountdown(3);
    } else {
      executeExport();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-96 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* === VIEW 1: CONFIGURATION === */}
        {view === "config" && (
          <>
            <div className="px-6 py-4 border-b border-surface-border bg-surface-secondary/50 flex items-center gap-3">
              <div className="p-2 bg-uml-class-bg rounded-lg text-uml-class-border">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-text-primary">
                {t("modals.export.title") || "Export Image"}
              </h3>
            </div>

            <div className="p-6 space-y-6">
              {/* Format */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  {t("modals.export.format") || "Format"}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormat("png")}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                      format === "png"
                        ? "bg-uml-class-bg border-uml-class-border text-uml-class-border ring-1 ring-uml-class-border"
                        : "bg-surface-secondary border-surface-border text-text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-xs font-bold">PNG</span>
                  </button>

                  <button
                    onClick={() => setFormat("svg")}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                      format === "svg"
                        ? "bg-uml-class-bg border-uml-class-border text-uml-class-border ring-1 ring-uml-class-border"
                        : "bg-surface-secondary border-surface-border text-text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    <FileCode className="w-6 h-6" />
                    <span className="text-xs font-bold">SVG</span>
                  </button>
                </div>
              </div>

              {/* Settings (PNG Only) */}
              {format === "png" && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    {t("modals.export.quality") || "Quality"}
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 4].map((s) => (
                      <button
                        key={s}
                        onClick={() => setScale(s)}
                        className={`flex-1 py-1.5 text-xs font-mono rounded border transition-all ${
                          scale === s
                            ? "bg-uml-class-border text-white border-uml-class-border"
                            : "bg-transparent border-surface-border text-text-secondary hover:border-text-secondary"
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="h-px bg-surface-border my-2" />

              {/* Toggles */}
              <div className="space-y-3">
                {/* 1. Transparent */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-primary">
                    {t("modals.export.transparent") || "Transparent Background"}
                  </span>
                  <button
                    onClick={() => setTransparent(!transparent)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      transparent ? "bg-uml-class-border" : "bg-text-muted/30"
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${transparent ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                </div>

                {/* 2. Highlight Connections (NEW) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm text-text-primary">
                      {t("modals.export.highlight") || "Highlight Connections"}
                    </span>
                  </div>
                  <button
                    onClick={() => setIncludeConnections(!includeConnections)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      includeConnections
                        ? "bg-uml-class-border"
                        : "bg-text-muted/30"
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${includeConnections ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-surface-secondary/30 border-t border-surface-border flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {t("modals.common.cancel")}
              </button>
              <button
                onClick={handleExportClick}
                disabled={isExporting}
                className="flex items-center gap-2 px-6 py-2 bg-uml-class-border text-white rounded font-medium shadow-md hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
              >
                {isExporting ? t("header.exportMenu.soon") : t("header.export")}
              </button>
            </div>
          </>
        )}

        {/* === VIEW 2: SVG WARNING === */}
        {view === "warning" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="px-6 py-4 border-b border-surface-border bg-amber-500/10 flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-text-primary">
                {t("modals.export.svgWarningTitle") || "SVG Compatibility"}
              </h3>
            </div>

            <div className="p-6">
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                {t("modals.export.svgWarningMessage") ||
                  "Some image viewers on Windows, Mac, or Linux might not display the exported SVG correctly because it contains embedded HTML styles."}
              </p>

              <div className="p-3 bg-surface-secondary border border-surface-border rounded-lg text-xs text-text-muted mb-6">
                <strong>💡 Tip:</strong>{" "}
                {t("modals.export.svgTip") ||
                  "If it looks broken, try opening the .svg file in your web browser (Chrome, Edge, etc)."}
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="rounded border-surface-border bg-surface-secondary text-uml-class-border focus:ring-uml-class-border"
                />
                <span className="text-sm text-text-secondary">
                  {t("modals.export.dontShowAgain") || "Don't show this again"}
                </span>
              </label>
            </div>

            <div className="px-6 py-4 bg-surface-secondary/30 border-t border-surface-border flex justify-between items-center">
              <button
                onClick={() => setView("config")}
                className="text-sm text-text-secondary hover:text-text-primary underline"
              >
                {t("modals.common.back")}
              </button>

              <button
                onClick={executeExport}
                disabled={countdown > 0}
                className={`flex items-center gap-2 px-6 py-2 rounded font-medium shadow-md transition-all 
                  ${
                    countdown > 0
                      ? "bg-surface-border text-text-muted cursor-not-allowed"
                      : "bg-amber-600 hover:bg-amber-500 text-white active:scale-95"
                  }`}
              >
                {countdown > 0 ? (
                  <>
                    <Timer className="w-4 h-4 animate-pulse" />
                    {t("modals.export.wait")} ({countdown}s)
                  </>
                ) : (
                  <>
                    {t("modals.common.continue")}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
