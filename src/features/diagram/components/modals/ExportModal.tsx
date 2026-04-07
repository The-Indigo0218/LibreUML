import { useState, useEffect, useCallback } from "react";
import {
  Download,
  Image as ImageIcon,
  FileCode,
  FileCode2,
  FileJson,
  Network,
  AlertTriangle,
  Timer,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../../../store/settingsStore";
import { useStageStore } from "../../../../canvas/store/stageStore";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { useModelStore } from "../../../../store/model.store";
import { ExportService } from "../../../../services/export.service";
import {
  downloadVfsDiagramXmi,
  downloadVfsDiagramJson,
} from "../../../../services/vfsExport.service";
import { isDiagramView } from "../../hooks/useVFSCanvasController";
import { useKonvaCanvasController } from "../../../../canvas/hooks/useKonvaCanvasController";
import type { VFSFile, DiagramView } from "../../../../core/domain/vfs/vfs.types";

type ExportFormat = "png" | "svg" | "xmi" | "json";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { t } = useTranslation();
  const stage = useStageStore((s) => s.stage);

  const { shapes, edges } = useKonvaCanvasController();
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const model = useModelStore((s) => s.model);
  const isVFSMode = !!project;
  const diagramFiles: VFSFile[] = isVFSMode
    ? (Object.values(project!.nodes).filter(
        (n) => n.type === "FILE" && (n as VFSFile).extension === ".luml",
      ) as VFSFile[])
    : [];

  const showAllEdges = useSettingsStore((s) => s.showAllEdges);
  const toggleShowAllEdges = useSettingsStore((s) => s.toggleShowAllEdges);
  const suppressSvgWarning = useSettingsStore((s) => s.suppressSvgWarning);
  const setSuppressSvgWarning = useSettingsStore((s) => s.setSuppressSvgWarning);

  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState<number>(2);
  const [transparent, setTransparent] = useState(false);
  const [includeConnections, setIncludeConnections] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string>("");

  const [isExporting, setIsExporting] = useState(false);

  const [view, setView] = useState<"config" | "warning">("config");
  const [countdown, setCountdown] = useState(3);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView("config");
      setCountdown(3);
      setDontShowAgain(false);
      setIncludeConnections(showAllEdges ?? false);
      setFormat("png");
      // Default file selector to active tab, or first diagram file
      const defaultId =
        activeTabId && diagramFiles.some((f) => f.id === activeTabId)
          ? activeTabId
          : diagramFiles[0]?.id ?? "";
      setSelectedFileId(defaultId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (view === "warning" && countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [view, countdown]);

  const selectedVFSFile = isVFSMode
    ? (project!.nodes[selectedFileId] as VFSFile | undefined)
    : undefined;

  const selectedDiagramView: DiagramView | null =
    selectedVFSFile && isDiagramView(selectedVFSFile.content)
      ? (selectedVFSFile.content as DiagramView)
      : null;

  const selectedFileName = selectedVFSFile?.name?.replace(/\.luml$/i, "") || "diagram";

  const getFile = useWorkspaceStore((s) => s.getFile);
  const legacyDiagramName = activeTabId ? getFile(activeTabId)?.name ?? "diagram" : "diagram";

  const executePngSvgExport = useCallback(async () => {
    if (!stage) {
      alert("Canvas not ready for export.");
      return;
    }
    setIsExporting(true);

    const computedStyle = getComputedStyle(document.documentElement);
    const bgColor = computedStyle.getPropertyValue("--canvas-base").trim();

    const originalShowEdgesState = useSettingsStore.getState().showAllEdges;
    let stateChanged = false;

    if (includeConnections && !originalShowEdgesState) {
      toggleShowAllEdges();
      stateChanged = true;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    try {
      const exportFileName = isVFSMode ? selectedFileName : legacyDiagramName;
      
      let nodes = selectedDiagramView?.nodes;
      if (!nodes && activeTabId && project) {
        const fileNode = project.nodes[activeTabId];
        if (fileNode && fileNode.type === 'FILE') {
          const content = (fileNode as VFSFile).content;
          if (isDiagramView(content)) {
            nodes = (content as DiagramView).nodes;
          }
        }
      }
      
      await ExportService.downloadImage(stage, {
        fileName: exportFileName,
        format: format as "png" | "svg",
        scale,
        transparent,
        backgroundColor: bgColor,
        nodes,
        shapes,
        edges,
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
      if (stateChanged) toggleShowAllEdges();
      setIsExporting(false);
    }
  }, [
    stage,
    format,
    scale,
    transparent,
    includeConnections,
    toggleShowAllEdges,
    onClose,
    t,
    dontShowAgain,
    setSuppressSvgWarning,
    isVFSMode,
    selectedFileName,
    legacyDiagramName,
  ]);

  const executeVfsExport = () => {
    if (!model) {
      alert("No semantic model loaded. Cannot export.");
      return;
    }
    if (format === "xmi") {
      downloadVfsDiagramXmi(model, selectedDiagramView, selectedFileName);
      onClose();
    } else if (format === "json") {
      downloadVfsDiagramJson(selectedDiagramView, selectedFileName);
      onClose();
    }
  };

  const handleExportClick = () => {
    if (format === "xmi" || format === "json") {
      executeVfsExport();
      return;
    }
    if (format === "svg" && !suppressSvgWarning) {
      setView("warning");
      setCountdown(3);
    } else {
      executePngSvgExport();
    }
  };

  const isExportDisabled =
    isExporting ||
    (isVFSMode && (format === "xmi" || format === "json") && !selectedFileId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-96 overflow-hidden animate-in zoom-in-95 duration-200">

        {view === "config" && (
          <>
            <div className="px-6 py-4 border-b border-surface-border bg-surface-secondary/50 flex items-center gap-3">
              <div className="p-2 bg-uml-class-bg rounded-lg text-uml-class-border">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-text-primary">
                {t("modals.export.title") || "Export Diagram"}
              </h3>
            </div>

            <div className="p-6 space-y-5">

              {/* VFS: file selector */}
              {isVFSMode && diagramFiles.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Diagram
                  </label>
                  <div className="relative">
                    <select
                      value={selectedFileId}
                      onChange={(e) => setSelectedFileId(e.target.value)}
                      className="w-full appearance-none px-3 py-2 pr-8 bg-surface-secondary border border-surface-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-uml-class-border"
                    >
                      {diagramFiles.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Format selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  {t("modals.export.format") || "Format"}
                </label>
                <div className={`grid gap-3 ${isVFSMode ? "grid-cols-4" : "grid-cols-2"}`}>
                  {/* PNG */}
                  <button
                    onClick={() => setFormat("png")}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                      format === "png"
                        ? "bg-uml-class-bg border-uml-class-border text-uml-class-border ring-1 ring-uml-class-border"
                        : "bg-surface-secondary border-surface-border text-text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-xs font-bold">PNG</span>
                  </button>

                  {/* SVG */}
                  <button
                    onClick={() => setFormat("svg")}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                      format === "svg"
                        ? "bg-uml-class-bg border-uml-class-border text-uml-class-border ring-1 ring-uml-class-border"
                        : "bg-surface-secondary border-surface-border text-text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    <FileCode className="w-5 h-5" />
                    <span className="text-xs font-bold">SVG</span>
                  </button>

                  {/* XMI (VFS only) */}
                  {isVFSMode && (
                    <button
                      onClick={() => setFormat("xmi")}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                        format === "xmi"
                          ? "bg-uml-class-bg border-uml-class-border text-uml-class-border ring-1 ring-uml-class-border"
                          : "bg-surface-secondary border-surface-border text-text-secondary hover:bg-surface-hover"
                      }`}
                    >
                      <FileCode2 className="w-5 h-5" />
                      <span className="text-xs font-bold">XMI</span>
                    </button>
                  )}

                  {/* JSON (VFS only) */}
                  {isVFSMode && (
                    <button
                      onClick={() => setFormat("json")}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                        format === "json"
                          ? "bg-uml-class-bg border-uml-class-border text-uml-class-border ring-1 ring-uml-class-border"
                          : "bg-surface-secondary border-surface-border text-text-secondary hover:bg-surface-hover"
                      }`}
                    >
                      <FileJson className="w-5 h-5" />
                      <span className="text-xs font-bold">JSON</span>
                    </button>
                  )}
                </div>
              </div>

              {/* PNG quality options */}
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

              {/* PNG/SVG toggles */}
              {(format === "png" || format === "svg") && (
                <>
                  <div className="h-px bg-surface-border" />
                  <div className="space-y-3">
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
                          includeConnections ? "bg-uml-class-border" : "bg-text-muted/30"
                        }`}
                      >
                        <div
                          className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${includeConnections ? "translate-x-5" : "translate-x-0"}`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* PNG/SVG note in VFS mode */}
                  {isVFSMode && (
                    <p className="text-xs text-text-muted">
                      PNG / SVG captures the current canvas view. Switch to the desired diagram tab first.
                    </p>
                  )}
                </>
              )}

              {/* XMI info */}
              {format === "xmi" && isVFSMode && (
                <p className="text-xs text-text-muted">
                  Exports all classifiers visible in the selected diagram as an XMI 2.1 file.
                </p>
              )}

              {/* JSON info */}
              {format === "json" && isVFSMode && (
                <p className="text-xs text-text-muted">
                  Downloads the DiagramView (node positions and edge layout) of the selected diagram as JSON.
                </p>
              )}
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
                disabled={isExportDisabled}
                className="flex items-center gap-2 px-6 py-2 bg-uml-class-border text-white rounded font-medium shadow-md hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
              >
                {isExporting ? t("header.exportMenu.soon") || "Exporting…" : t("header.export") || "Export"}
              </button>
            </div>
          </>
        )}

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
                onClick={executePngSvgExport}
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
