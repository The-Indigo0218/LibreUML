import { Pencil, FileOutput, Settings, GraduationCap, HelpCircle } from "lucide-react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import WindowControls from "../../../../components/ui/menubar/WindowControls";
import { useDiagramActions } from "../../hooks/useDiagramActions";
import { useState, useRef, useEffect } from "react";

import UnsavedChangesModal from "../modals/UnsavedChangesModal";
import ConfirmationModal from "../../../../components/shared/ConfirmationModal";
import { MenubarTrigger } from "../../../../components/ui/menubar/MenubarTrigger";
import { MenubarSubMenu } from "../../../../components/ui/menubar/MenubarSubMenu";

import { FileMenu } from "./modules/FileMenu";
import { ViewMenu, ViewMenuContent } from "./modules/ViewMenu";
import { SettingsMenu, SettingsMenuContent } from "./modules/SettingsMenu";
import { EditMenu } from "./modules/EditMenu";
import { ExportMenu, ExportMenuContent } from "./modules/ExportMenu";
import { CodeMenu } from "./modules/CodeMenu";
import { EduMenu, EduMenuContent } from "./modules/EduMenu";
import { HelpMenu, HelpMenuContent } from "./modules/HelpMenu";
import { useTranslation } from "react-i18next";

export default function AppMenubar() {
  const { t } = useTranslation();
  const getActiveFile = useWorkspaceStore((s) => s.getActiveFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  
  const activeFile = getActiveFile();
  const fileName = activeFile?.name || "ProjectName";
  const displayName = fileName.replace(/\.luml$/i, '') || "ProjectName";
  const isDirty = activeFile?.isDirty || false;

  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = useDiagramActions();
  const { modalState } = actions;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setIsEditing(false);
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  const handleNameChange = (newName: string) => {
    if (activeFile) {
      updateFile(activeFile.id, { name: newName });
    }
  };

  if (!modalState) return null;

  return (
    <>
      <header className="h-10 w-full bg-surface-primary border-b border-surface-border flex items-center justify-between select-none drag-region pl-3 pr-0 z-50 shrink-0">
        <div className="flex items-center gap-1 h-full shrink-0">
          <div className="flex items-center gap-2 font-bold text-sm no-drag mr-4 shrink-0">
            <img
              src="/logoTitle.svg"
              alt="LibreUML Logo"
              className="w-6 h-6 object-contain drop-shadow-sm"
            />
            <span className="text-text-primary tracking-tight hidden sm:block">
              LibreUML
            </span>
          </div>

          <div className="flex items-center h-full no-drag shrink-0">
            <FileMenu actions={actions} />
            <EditMenu />
            <ViewMenu />
            <CodeMenu />
            
            <div className="hidden lg:flex items-center h-full shrink-0">
              <ExportMenu />
              <SettingsMenu />
              <EduMenu />
              <HelpMenu />
            </div>

            <div className="lg:hidden shrink-0">
              <MenubarTrigger label="•••">
                <MenubarSubMenu label={t("menubar.view.title")} icon={<FileOutput className="w-4 h-4" />}>
                  <ViewMenuContent />
                </MenubarSubMenu>
                
                <MenubarSubMenu label={t("menubar.export.title")} icon={<FileOutput className="w-4 h-4" />}>
                  <ExportMenuContent />
                </MenubarSubMenu>
                
                <MenubarSubMenu label={t("menubar.settings.title")} icon={<Settings className="w-4 h-4" />}>
                  <SettingsMenuContent />
                </MenubarSubMenu>
                
                <MenubarSubMenu label={t("menubar.edu.title")} icon={<GraduationCap className="w-4 h-4" />}>
                  <EduMenuContent />
                </MenubarSubMenu>
                
                <MenubarSubMenu label={t("menubar.help.title")} icon={<HelpCircle className="w-4 h-4" />}>
                  <HelpMenuContent />
                </MenubarSubMenu>
              </MenubarTrigger>
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 text-xs text-text-muted hidden md:flex items-center gap-2 no-drag">
          {isEditing ? (
            <div className="flex items-center bg-white/5 rounded px-1 ring-1 ring-blue-500/30">
              <input
                ref={inputRef}
                value={displayName}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="bg-transparent text-center outline-none w-auto min-w-5 max-w-37.5 text-text-primary font-medium"
                placeholder="ProjectName"
              />
            </div>
          ) : (
            <div
              className="flex items-center gap-2 group cursor-pointer hover:text-text-primary transition-colors py-1 px-2 rounded hover:bg-white/5"
              onClick={() => setIsEditing(true)}
            >
              <span className="font-medium">{displayName}</span>
              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
            </div>
          )}

          {isDirty && (
            <div
              className="w-1.5 h-1.5 rounded-full bg-amber-400"
              title="Unsaved changes"
            />
          )}
        </div>

        <div className="flex items-center no-drag shrink-0">
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

