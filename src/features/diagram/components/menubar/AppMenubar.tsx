import { Pencil, UserCircle2 } from "lucide-react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import WindowControls from "../../../../components/ui/menubar/WindowControls";
import { useDiagramActions } from "../../hooks/useDiagramActions";
import { useState, useRef, useEffect } from "react";

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

export default function AppMenubar() {
  const getActiveFile = useWorkspaceStore((s) => s.getActiveFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  
  const activeFile = getActiveFile();
  const diagramName = activeFile?.name || "Untitled Diagram";
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
    if (activeFile && !diagramName.trim()) {
      updateFile(activeFile.id, { name: "Untitled Diagram" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") setIsEditing(false);
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
            <ViewMenu />
            <ExportMenu />
            <SettingsMenu />
            <EduMenu />
            <HelpMenu />
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 text-xs text-text-muted hidden md:flex items-center gap-2 no-drag">
          {isEditing ? (
            <div className="flex items-center bg-white/5 rounded px-1 ring-1 ring-blue-500/30">
              <input
                ref={inputRef}
                value={diagramName}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="bg-transparent text-right outline-none w-auto min-w-5 max-w-37.5 text-text-primary"
                placeholder="Untitled"
              />
              <span className="text-text-muted select-none">.luml</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 group cursor-pointer hover:text-text-primary transition-colors py-1 px-2 rounded hover:bg-white/5"
              onClick={() => setIsEditing(true)}
            >
              <span className="font-medium">{diagramName}.luml</span>
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

        <div className="flex items-center no-drag">
          <div
            className="mr-2 p-1.5 text-text-muted/40 cursor-not-allowed flex items-center justify-center rounded-full hover:bg-white/5 relative group"
            title="Login coming soon"
          >
            <UserCircle2 className="w-5 h-5" />
          </div>

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
