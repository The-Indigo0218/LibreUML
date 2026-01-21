import { useRef, useState, useEffect, useCallback } from "react";
import { useReactFlow } from "reactflow";
import { useStore } from "zustand";
import {
  Box,
  Download,
  Save,
  FolderOpen,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize,
  Moon,
  Languages,
  Sun,
  Map,
  ChevronDown,
  FileJson,
  Image as ImageIcon,
  Cloud,
  Search,
  XCircle, 
} from "lucide-react";
import { useDiagramStore } from "../../../../store/diagramStore";
import { ExportService } from "../../../../services/export.service";
import { useThemeStore } from "../../../../store/themeStore";
import { useSpotlightStore } from "../../hooks/useSpotlight";
import { useTranslation } from "react-i18next";
import { StorageService } from "../../../../services/storage.service";
import Toast from "../../../../components/shared/Toast";
import NameConflictModal from "../../../../components/shared/NameConflictModal"; 
import UnsavedChangesModal from "../modals/UnsavedChangesModal"; 

const clearBackup = () => {
  localStorage.removeItem('libreuml-backup');
  localStorage.removeItem('libreuml-backup-timestamp');
};

export default function Header() {
  const { zoomIn, zoomOut, fitView, toObject, setViewport, getNodes } =
    useReactFlow();
  const { undo, redo } = useDiagramStore.temporal.getState();

  // ---  Local States ---
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<"closeFile" | "closeApp" | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // --- STORE HOOKS ---
  const canUndo = useStore(
    useDiagramStore.temporal,
    (state) => state.pastStates.length > 0,
  );
  const canRedo = useStore(
    useDiagramStore.temporal,
    (state) => state.futureStates.length > 0,
  );

  const {
    diagramName,
    diagramId,
    setDiagramName,
    loadDiagram,
    showMiniMap,
    toggleMiniMap,
    currentFilePath,
    setFilePath,
    isDirty,
    setDirty,
    resetDiagram, 
  } = useDiagramStore();

  const { isDarkMode, toggleTheme } = useThemeStore();
  const { toggle: toggleSpotlight } = useSpotlightStore();
  const { t, i18n } = useTranslation();

  // --- AUXILIARY FUNCTIONS ---
  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "es" : "en";
    i18n.changeLanguage(newLang);
  };

  // --- CORE SAVE LOGIC ---
  // Returns true if successful, false if failed or canceled
  const executeSave = async (forceSaveAsNew: boolean = false): Promise<boolean> => {
    const flowObject = toObject();
    document.body.style.cursor = "wait";

    const pathCallback = forceSaveAsNew ? undefined : currentFilePath;

    const result = await StorageService.saveDiagram(
      flowObject,
      diagramId,
      diagramName,
      pathCallback,
    );

    document.body.style.cursor = "default";

    if (result.success) {
      if (result.filePath) {
        setFilePath(result.filePath);
        const fileName = result.filePath
          .split(/[\\/]/)
          .pop()
          ?.replace(".luml", "");
        if (fileName) setDiagramName(fileName);
      }

      setDirty(false);

      setToast({
        message: t("alerts.savedSuccess") || "Diagrama guardado correctamente",
        type: "success",
      });
      setShowConflictModal(false);
      return true;
    } else if (result.canceled) {
      return false;
    } else {
      setToast({ message: "Error al guardar el archivo", type: "error" });
      setShowConflictModal(false);
      return false; 
    }
  };

  // --- CLOSE HANDLERS AND MODALS ---

  useEffect(() => {
    if (!window.electronAPI?.isElectron()) return;

    const unsubscribe = window.electronAPI.onAppRequestClose(() => {
      if (isDirty) {
        setPendingAction("closeApp");
        setShowUnsavedModal(true);
      } else {
        clearBackup(); 
        window.electronAPI!.sendForceClose();
      }
    });

    return () => unsubscribe();
  }, [isDirty]);

  const handleCloseFile = () => {
    if (isDirty) {
      setPendingAction("closeFile");
      setShowUnsavedModal(true);
    } else {
      resetDiagram();
    }
  };

 const handleDiscardChanges = () => {
    setShowUnsavedModal(false);
    
    clearBackup(); 

    if (pendingAction === "closeApp") {
      window.electronAPI?.sendForceClose();
    } else {
      resetDiagram(); 
    }
    setPendingAction(null);
  };

 const handleSaveAndProceed = async () => {
    const success = await executeSave(false);
    
    if (success) {
      setShowUnsavedModal(false);
      clearBackup(); 
      
      if (pendingAction === "closeApp") {
        window.electronAPI?.sendForceClose();
      } else {
        resetDiagram();
      }
      setPendingAction(null);
    }
  };


  // --- UI INTERACTIONS ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    document.title = isDirty
      ? `LibreUML - ${diagramName} *`
      : `LibreUML - ${diagramName}`;
  }, [isDirty, diagramName]);

  const handleExportJson = () => {
    const flowObject = toObject();
    ExportService.downloadJson(flowObject, diagramId, diagramName);
    setIsExportMenuOpen(false);
  };

  const handleExportImage = async () => {
    const viewportEl = document.querySelector(".react-flow__viewport") as HTMLElement;
    if (!viewportEl) return;

    try {
      const nodes = getNodes();
      await ExportService.downloadPng(viewportEl, nodes, diagramName);
    } catch (error) {
      console.error("Error exportando imagen:", error);
      alert(t("alerts.exportError"));
    }
    setIsExportMenuOpen(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        loadDiagram(parsedData);
        if (parsedData.viewport) {
          const { x, y, zoom } = parsedData.viewport;
          setViewport({ x, y, zoom });
        } else {
          setTimeout(() => fitView({ duration: 800 }), 100);
        }
      } catch (error) {
        console.error("Error loading file:", error);
        alert(t("alerts.importError"));
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleSaveClick = useCallback(async () => {
    if (window.electronAPI?.isElectron() && currentFilePath) {
      const currentFileName = currentFilePath.split(/[\\/]/).pop()?.replace(".luml", "");
      if (currentFileName && currentFileName !== diagramName) {
        setShowConflictModal(true);
        return;
      }
    }
    await executeSave(false);
  }, [diagramName, currentFilePath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveClick();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveClick]);

  const handleSmartImport = async () => {
    if (window.electronAPI?.isElectron()) {
      const result = await StorageService.openDiagram();
      if (result) {
        loadDiagram(result.data);
        if (result.filePath) {
          setFilePath(result.filePath);
          const fileName = result.filePath.split(/[\\/]/).pop()?.replace(".luml", "");
          if (fileName) setDiagramName(fileName);
        }
      }
    } else {
      handleImportClick();
    }
  };

  return (
    <>
      <header className="h-14 bg-surface-primary border-b border-surface-border grid grid-cols-[1fr_auto_1fr] items-center px-4 z-20 relative shadow-md font-sans">
        
        {/* LEFT SECTION */}
        <div className="flex items-center gap-4 justify-self-start">
          <div className="flex items-center gap-2 font-bold text-lg select-none">
            <Box className="w-6 h-6 text-uml-class-border fill-uml-class-bg/20" />
            <span className="text-text-primary tracking-tight">LibreUML</span>
          </div>
          <div className="h-5 w-px bg-surface-border mx-2" />
          <input
            type="text"
            value={diagramName}
            onChange={(e) => setDiagramName(e.target.value)}
            className="text-sm font-medium bg-surface-secondary text-text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-white focus:outline-none focus:ring-1 focus:ring-uml-class-border rounded px-2 py-1 transition-all w-32 sm:w-48 truncate border border-transparent"
            placeholder={t("header.diagramNamePlaceholder")}
          />
          {isDirty && (
            <span className="absolute -right-3 top-0 text-amber-400 font-bold text-lg animate-pulse" title="Unsaved changes">*</span>
          )}
        </div>

        {/* CENTER SECTION: Toolbar */}
        <div className="flex items-center gap-1 bg-surface-secondary p-1 rounded-lg border border-surface-border shadow-lg justify-self-center">
          <IconButton onClick={() => undo()} icon={<Undo className="w-4 h-4" />} tooltip={t("header.tooltips.undo")} disabled={!canUndo} />
          <IconButton onClick={() => redo()} icon={<Redo className="w-4 h-4" />} tooltip={t("header.tooltips.redo")} disabled={!canRedo} />
          <div className="w-px h-4 bg-surface-border mx-1" />
          <IconButton onClick={toggleMiniMap} icon={<Map className={`w-4 h-4 transition-colors ${showMiniMap ? "text-uml-class-border fill-uml-class-bg" : ""}`} />} tooltip={showMiniMap ? t("header.tooltips.hideMiniMap") : t("header.tooltips.showMiniMap")} />
          <div className="w-px h-4 bg-surface-border mx-1" />
          <IconButton onClick={() => zoomOut()} icon={<ZoomOut className="w-4 h-4" />} tooltip={t("header.tooltips.zoomOut")} />
          <IconButton onClick={() => fitView({ duration: 800 })} icon={<Maximize className="w-4 h-4" />} tooltip={t("header.tooltips.fitView")} />
          <IconButton onClick={() => zoomIn()} icon={<ZoomIn className="w-4 h-4" />} tooltip={t("header.tooltips.zoomIn")} />
        </div>

        {/* RIGHT SECTION: Actions */}
        <div className="flex items-center gap-2 justify-self-end">
          <div className="flex items-center gap-1 mr-2">
            <button onClick={toggleSpotlight} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-md transition-all border border-transparent hover:border-surface-border mr-1" title={`${t("header.search")} (Ctrl+K)`}>
              <Search className="w-4 h-4" />
              <span className="hidden lg:inline">{t("header.search")}</span>
              <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-surface-border bg-surface-secondary px-1.5 font-mono text-[10px] font-medium text-text-muted"><span className="text-xs">⌘+K</span></kbd>
            </button>
            <button onClick={toggleTheme} className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors">
              {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button onClick={toggleLanguage} className="flex items-center gap-1.5 px-2 py-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors" title={t("header.switchLanguage")}>
              <Languages className="w-4 h-4" />
              <span className="text-xs font-bold w-4">{i18n.language.toUpperCase()}</span>
            </button>
          </div>

          <div className="h-5 w-px bg-surface-border mx-1" />

          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json,.luml" className="hidden" />

          <button onClick={handleSmartImport} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors border border-transparent hover:border-surface-border">
            <FolderOpen className="w-4 h-4" /> {t("header.import")}
          </button>

          {/* EXPORT MENU */}
          <div className="relative" ref={exportMenuRef}>
            <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors border rounded-md ${isExportMenuOpen ? "bg-surface-hover text-text-primary border-surface-border" : "text-text-secondary hover:text-text-primary hover:bg-surface-hover border-transparent hover:border-surface-border"}`}>
              <Download className="w-4 h-4" />
              {t("header.export")}
              <ChevronDown className={`w-3 h-3 transition-transform ${isExportMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {isExportMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-surface-primary border border-surface-border rounded-md shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                <button onClick={handleExportJson} className="flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover text-left transition-colors">
                  <FileJson className="w-4 h-4 text-uml-class-border" />
                  <span>{t("header.exportMenu.json")}</span>
                </button>
                <button onClick={handleExportImage} className="flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover text-left transition-colors">
                  <ImageIcon className="w-4 h-4 text-purple-400" />
                  <span>{t("header.exportMenu.png")}</span>
                </button>
                <div className="h-px bg-surface-border my-1 mx-2" />
                <button disabled className="flex items-center gap-3 px-4 py-2 text-sm text-text-muted cursor-not-allowed opacity-50 text-left">
                  <Cloud className="w-4 h-4" />
                  <span>{t("header.exportMenu.cloud")}</span>
                  <span className="ml-auto text-[10px] bg-surface-secondary px-1.5 py-0.5 rounded border border-surface-border uppercase tracking-wider font-bold">{t("header.exportMenu.soon")}</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-surface-border mx-1" />

          <button
            onClick={handleCloseFile}
            className="p-2 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
            title="Cerrar Archivo / Limpiar Lienzo"
          >
            <XCircle className="w-5 h-5" />
          </button>

          <button
            onClick={handleSaveClick}
            className="p-2 text-white bg-uml-class-border hover:brightness-110 rounded-md transition-all shadow-sm ml-1"
            title={`${t("header.save")} (Ctrl+S)`}
          >
            <Save className="w-5 h-5" />
          </button>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </header>

      <NameConflictModal
        isOpen={showConflictModal}
        diagramName={diagramName}
        currentFileName={currentFilePath ? currentFilePath.split(/[\\/]/).pop()?.replace(".luml", "") || "" : ""}
        onSaveAsNew={() => executeSave(true)}
        onOverwrite={() => executeSave(false)}
        onCancel={() => setShowConflictModal(false)}
      />

      <UnsavedChangesModal 
        isOpen={showUnsavedModal}
        fileName={diagramName}
        onSave={handleSaveAndProceed}
        onDiscard={handleDiscardChanges}
        onCancel={() => {
          setShowUnsavedModal(false);
          setPendingAction(null);
        }}
      />
    </>
  );
}

interface IconButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  tooltip?: string;
  disabled?: boolean;
}

function IconButton({ icon, onClick, disabled, tooltip }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:shadow-sm rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      title={tooltip}
    >
      {icon}
    </button>
  );
}