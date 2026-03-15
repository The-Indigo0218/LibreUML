import { MoreHorizontal, Eye, FileOutput, Settings, GraduationCap, HelpCircle, ZoomIn, ZoomOut, Maximize, Map, Search, Grid3X3, Magnet, Network, Wand2, Check, SaveAll, PlayCircle, FileType, Languages, Moon, Sun, Download, Share2, Award, CheckCircle2, Gamepad2, ScrollText, BookOpen, Bug, Info, Rocket } from "lucide-react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import WindowControls from "../../../../components/ui/menubar/WindowControls";
import { useDiagramActions } from "../../hooks/useDiagramActions";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

import UnsavedChangesModal from "../modals/UnsavedChangesModal";
import ConfirmationModal from "../../../../components/shared/ConfirmationModal";

import { FileMenu } from "./modules/FileMenu";
import { ViewMenu } from "./modules/ViewMenu";
import { SettingsMenu } from "./modules/SettingsMenu";
import { EditMenu } from "./modules/EditMenu";
import { ExportMenu } from "./modules/ExportMenu";
import { CodeMenu } from "./modules/CodeMenu";
import { EduMenu } from "./modules/EduMenu";
import { HelpMenu } from "./modules/HelpMenu";
import { MenubarTrigger } from "../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../components/ui/menubar/MenubarItem";
import { MenubarSubMenu } from "../../../../components/ui/menubar/MenubarSubMenu";
import { useReactFlow } from "reactflow";
import { useSpotlightStore } from "../../hooks/useSpotlight";
import { useSettingsStore } from "../../../../store/settingsStore";
import { useUiStore } from "../../../../store/uiStore";
import { useProjectStore } from "../../../../store/project.store";
import { XmiConverterService } from "../../../../services/xmiConverter.service";
import { getDiagramRegistry } from "../../../../core/registry/diagram-registry";
import { getIconComponent } from "../../../../core/registry/icon-map";
import { useLayoutActions } from "../../hooks/actions/useLayoutActions";

export default function AppMenubar() {
  const { t } = useTranslation();
  const projectName = useWorkspaceStore((s) => s.projectName);

  const actions = useDiagramActions();
  const { modalState } = actions;

  // React Flow Controls
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  
  // View Settings
  const showMiniMap = useSettingsStore((s) => s.showMiniMap);
  const toggleMiniMap = useSettingsStore((s) => s.toggleMiniMap);
  const showGrid = useSettingsStore((s) => s.showGrid);
  const toggleGrid = useSettingsStore((s) => s.toggleGrid);
  const snapToGrid = useSettingsStore((s) => s.snapToGrid);
  const toggleSnapToGrid = useSettingsStore((s) => s.toggleSnapToGrid);
  const showAllEdges = useSettingsStore((s) => s.showAllEdges);
  const toggleShowAllEdges = useSettingsStore((s) => s.toggleShowAllEdges);
  
  // Spotlight
  const toggleSpotlight = useSpotlightStore((s) => s.toggle);
  
  // Layout
  const { applyAutoLayout } = useLayoutActions();
  
  // Settings
  const autoSave = useSettingsStore((s) => s.autoSave);
  const toggleAutoSave = useSettingsStore((s) => s.toggleAutoSave);
  const restoreSession = useSettingsStore((s) => s.restoreSession);
  const toggleRestoreSession = useSettingsStore((s) => s.toggleRestoreSession);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  
  // Export
  const openExportModal = useUiStore((s) => s.openExportModal);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const getFile = useWorkspaceStore((s) => s.getFile);
  const activeFile = activeFileId ? getFile(activeFileId) : null;
  const diagramName = activeFile?.name || "diagram";
  const diagramType = activeFile?.diagramType || 'CLASS_DIAGRAM';
  const getNodes = useProjectStore((s) => s.getNodes);
  const getEdges = useProjectStore((s) => s.getEdges);
  
  // Get export actions from registry
  const exportActions = useMemo(() => {
    try {
      const registry = getDiagramRegistry(diagramType);
      return registry.exportActions;
    } catch (error) {
      console.error('Failed to get export actions:', error);
      return [];
    }
  }, [diagramType]);

  // Helper functions
  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'es' : 'en';
    setLanguage(newLang);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleAssociateFiles = async () => {
    if (window.electronAPI?.isElectron()) {
      const result = await window.electronAPI.associateFiles();
      if (result.success) {
        alert("File association configured!");
      } else {
        alert("Error: " + result.error);
      }
    } else {
      alert("Only available in Desktop App");
    }
  };

  const handleExportXmi = () => {
    if (!activeFile) return;
    
    const domainNodes = getNodes(activeFile.nodeIds);
    const domainEdges = getEdges(activeFile.edgeIds);
    const exportId = crypto.randomUUID();

    XmiConverterService.downloadXmi(
      exportId,
      diagramName,
      domainNodes,
      domainEdges
    );
  };

  const openDocs = () => window.open("https://github.com/The-Indigo0218/LibreUML#readme", "_blank");
  const reportIssue = () => window.open("https://github.com/The-Indigo0218/LibreUML/issues", "_blank");
  const openRoadmap = () => window.open("https://github.com/The-Indigo0218/LibreUML/blob/main/roadmap.md", "_blank");
  
  const showAbout = () => {
    alert("LibreUML v1.0.0\n\nThe Open Source UML Editor for Students.\nDeveloped with ❤️ in React + Electron.");
  };

  if (!modalState) return null;

  return (
    <>
      <header className="h-10 w-full bg-surface-primary border-b border-surface-border flex items-center justify-between select-none drag-region pl-3 pr-0 z-50 shrink-0">
        <div className="flex items-center gap-1 h-full">
          <div className="flex items-center gap-2 font-bold text-sm no-drag mr-4">
            <img
              src="/logoTitle.svg"
              alt="LibreUML Logo"
              className="w-6 h-6 object-contain drop-shadow-sm"
            />
            <span className="text-text-primary tracking-tight hidden sm:block">
              LibreUML
            </span>
          </div>

          <div className="flex items-center h-full no-drag">
            <FileMenu actions={actions} />
            <EditMenu />
            <CodeMenu />
            
            {/* Show all menus on large screens */}
            <div className="hidden lg:flex items-center h-full">
              <ViewMenu />
              <ExportMenu />
              <SettingsMenu />
              <EduMenu />
              <HelpMenu />
            </div>
            
            {/* Collapse into "..." menu on smaller screens - PHASE 9.6.1: Complete Deep Nesting */}
            <div className="lg:hidden h-full flex items-center">
              <MenubarTrigger label="•••">
                
                {/* ========== VIEW SUBMENU ========== */}
                <MenubarSubMenu label={t("menubar.view.title")} icon={<Eye className="w-4 h-4" />}>
                  {/* Zoom Controls */}
                  <MenubarItem 
                    label={t("menubar.view.zoomIn")} 
                    icon={<ZoomIn className="w-4 h-4" />}
                    shortcut="Ctrl + +"
                    onClick={() => zoomIn({ duration: 300 })} 
                  />
                  <MenubarItem 
                    label={t("menubar.view.zoomOut")} 
                    icon={<ZoomOut className="w-4 h-4" />}
                    shortcut="Ctrl + -"
                    onClick={() => zoomOut({ duration: 300 })} 
                  />
                  <MenubarItem 
                    label={t("menubar.view.fitView")} 
                    icon={<Maximize className="w-4 h-4" />}
                    shortcut="Space"
                    onClick={() => fitView({ duration: 800 })} 
                  />
                  
                  <div className="h-px bg-surface-border my-1" />
                  
                  {/* Visual Aids */}
                  <MenubarItem 
                    label={t("menubar.view.minimap")} 
                    icon={
                      <div className="relative">
                        <Map className="w-4 h-4" />
                        {showMiniMap && <Check className="w-3 h-3 absolute -bottom-1 -right-1 text-green-500 font-bold" />}
                      </div>
                    }
                    onClick={toggleMiniMap} 
                  />
                  <MenubarItem 
                    label={t("menubar.view.grid")} 
                    icon={
                      <div className="relative">
                        <Grid3X3 className="w-4 h-4" />
                        {showGrid && <Check className="w-3 h-3 absolute -bottom-1 -right-1 text-green-500 font-bold" />}
                      </div>
                    }
                    onClick={toggleGrid} 
                  />
                  <MenubarItem 
                    label={t("menubar.view.snap")} 
                    icon={
                      <div className="relative">
                        <Magnet className="w-4 h-4" />
                        {snapToGrid && <Check className="w-3 h-3 absolute -bottom-1 -right-1 text-green-500 font-bold" />}
                      </div>
                    }
                    onClick={toggleSnapToGrid} 
                  />
                  <MenubarItem 
                    label={t("menubar.view.connections")} 
                    icon={
                      <div className="relative">
                        <Network className="w-4 h-4" />
                        {showAllEdges && <Check className="w-3 h-3 absolute -bottom-1 -right-1 text-green-500 font-bold" />}
                      </div>
                    }
                    onClick={toggleShowAllEdges} 
                  />
                  
                  <div className="h-px bg-surface-border my-1" />
                  
                  {/* Tools */}
                  <MenubarItem 
                    label={t("menubar.view.spotlight")} 
                    icon={<Search className="w-4 h-4" />}
                    shortcut="Ctrl + K"
                    onClick={toggleSpotlight} 
                  />
                  <MenubarItem 
                    label={t("menubar.view.magicLayout")} 
                    icon={<Wand2 className="w-4 h-4 text-purple-400" />}
                    shortcut="Ctrl + L"
                    onClick={() => applyAutoLayout("TB")} 
                  />
                </MenubarSubMenu>

                {/* ========== EXPORT SUBMENU ========== */}
                <MenubarSubMenu label={t("menubar.export.title")} icon={<FileOutput className="w-4 h-4" />}>
                  {/* Dynamic Export Actions from Registry */}
                  {exportActions.map((action) => {
                    const IconComponent = getIconComponent(action.icon);
                    const handler = action.id === 'export-image' ? openExportModal : 
                                   action.id === 'export-xmi' ? handleExportXmi : 
                                   undefined;
                    
                    return (
                      <MenubarItem
                        key={action.id}
                        label={action.translationKey ? t(action.translationKey) : action.label}
                        icon={IconComponent ? <IconComponent className="w-4 h-4" /> : undefined}
                        shortcut={action.id === 'export-image' ? 'Ctrl+E' : undefined}
                        onClick={handler}
                        disabled={!action.enabled}
                      />
                    );
                  })}
                  
                  <div className="h-px bg-surface-border my-1" />
                  
                  {/* Future Features */}
                  <MenubarItem 
                    label={t("menubar.export.pdf")} 
                    icon={<Download className="w-4 h-4" />}
                    disabled={true}
                  />
                  <MenubarItem 
                    label={t("menubar.export.github")} 
                    icon={<Share2 className="w-4 h-4" />}
                    disabled={true}
                  />
                </MenubarSubMenu>

                {/* ========== SETTINGS SUBMENU ========== */}
                <MenubarSubMenu label={t("menubar.settings.title")} icon={<Settings className="w-4 h-4" />}>
                  {/* General Preferences */}
                  <MenubarItem 
                    label={t("menubar.settings.autoSave")} 
                    icon={
                      <div className="relative">
                        <SaveAll className="w-4 h-4" />
                        {autoSave && <Check className="w-3 h-3 absolute -bottom-1 -right-1 text-green-500 font-bold" />}
                      </div>
                    }
                    onClick={toggleAutoSave} 
                  />
                  <MenubarItem 
                    label={t("menubar.settings.startup")} 
                    icon={
                      <div className="relative">
                        <PlayCircle className="w-4 h-4" />
                        {restoreSession && <Check className="w-3 h-3 absolute -bottom-1 -right-1 text-green-500 font-bold" />}
                      </div>
                    }
                    onClick={toggleRestoreSession} 
                  />
                  
                  <div className="h-px bg-surface-border my-1" />
                  
                  {/* System Integration */}
                  <MenubarItem 
                    label={t("menubar.settings.fileAssoc")} 
                    icon={<FileType className="w-4 h-4" />}
                    onClick={handleAssociateFiles} 
                  />
                  
                  <div className="h-px bg-surface-border my-1" />
                  
                  {/* Appearance & Localization */}
                  <MenubarItem 
                    label={`${t("menubar.settings.language")}: ${language.toUpperCase()}`} 
                    icon={<Languages className="w-4 h-4" />}
                    onClick={toggleLanguage} 
                  />
                  <MenubarItem 
                    label={theme === 'dark' ? "Theme: Dark" : "Theme: Light"} 
                    icon={theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    onClick={toggleTheme} 
                  />
                </MenubarSubMenu>

                {/* ========== EDU SUBMENU ========== */}
                <MenubarSubMenu label={t("menubar.edu.title")} icon={<GraduationCap className="w-4 h-4" />}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-text-muted select-none">
                    Learning Tools (Coming Soon)
                  </div>
                  
                  <MenubarItem 
                    label={t("menubar.edu.linter")} 
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    disabled={true}
                  />
                  <MenubarItem 
                    label={t("menubar.edu.exam")} 
                    icon={<GraduationCap className="w-4 h-4" />}
                    disabled={true}
                  />
                  
                  <div className="h-px bg-surface-border my-1" />
                  
                  <MenubarItem 
                    label={t("menubar.edu.achievements")} 
                    icon={<Award className="w-4 h-4" />}
                    disabled={true}
                  />
                  <MenubarItem 
                    label={t("menubar.edu.gamification")} 
                    icon={<Gamepad2 className="w-4 h-4" />}
                    disabled={true}
                  />
                  <MenubarItem 
                    label={t("menubar.edu.certificates")} 
                    icon={<ScrollText className="w-4 h-4" />}
                    disabled={true}
                  />
                </MenubarSubMenu>

                {/* ========== HELP SUBMENU ========== */}
                <MenubarSubMenu label={t("menubar.help.title")} icon={<HelpCircle className="w-4 h-4" />}>
                  <MenubarItem 
                    label={t("menubar.help.gettingStarted")} 
                    icon={<Rocket className="w-4 h-4" />}
                    disabled={true}
                  />
                  <MenubarItem 
                    label={t("menubar.help.documentation")} 
                    icon={<BookOpen className="w-4 h-4" />}
                    onClick={openDocs} 
                  />
                  <MenubarItem 
                    label={t("menubar.help.reportIssue")} 
                    icon={<Bug className="w-4 h-4" />}
                    onClick={reportIssue} 
                  />
                  
                  <div className="h-px bg-surface-border my-1" />
                  
                  <MenubarItem 
                    label={t("menubar.help.roadmap")} 
                    icon={<Map className="w-4 h-4" />}
                    onClick={openRoadmap} 
                  />
                  <MenubarItem 
                    label={t("menubar.help.about")} 
                    icon={<Info className="w-4 h-4" />}
                    onClick={showAbout} 
                  />
                </MenubarSubMenu>
                
              </MenubarTrigger>
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-text-primary no-drag pointer-events-none">
          {projectName}
        </div>

        <div className="flex items-center no-drag">
          <WindowControls />
        </div>
      </header>

      <UnsavedChangesModal
        isOpen={modalState.unsaved.isOpen}
        fileName={modalState.unsaved.fileName}
        onDiscard={modalState.unsaved.onDiscard}
        onSave={modalState.unsaved.onSave}
        onCancel={modalState.unsaved.onCancel}
      />

      <ConfirmationModal
        isOpen={modalState.confirmation.isOpen}
        title={modalState.confirmation.title}
        message={modalState.confirmation.message}
        onConfirm={modalState.confirmation.onConfirm}
        onCancel={modalState.confirmation.onCancel}
      />
    </>
  );
}
