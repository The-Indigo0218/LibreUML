import { Box } from "lucide-react";
import { useDiagramStore } from "../../../../store/diagramStore";
import WindowControls from "../../../../components/ui/menubar/WindowControls"; 
import { useDiagramActions } from "../../hooks/useDiagramActions";

// Modales
import UnsavedChangesModal from "../modals/UnsavedChangesModal";
import ConfirmationModal from "../../../../components/shared/ConfirmationModal"; 

// Modules
import { FileMenu } from "./modules/FileMenu";
import { SettingsMenu } from "./modules/SettingsMenu"; 

export default function AppMenubar() {
  const diagramName = useDiagramStore((s) => s.diagramName);
  const isDirty = useDiagramStore((s) => s.isDirty);
  
  const actions = useDiagramActions(); 
  const { modals } = actions;

  return (
    <>
      <header className="h-10 w-full bg-surface-primary border-b border-surface-border flex items-center justify-between select-none drag-region pl-3 pr-0 z-50 shrink-0">
        
        {/* LEFT: Logo + Menus */}
        <div className="flex items-center gap-1 h-full">
          <div className="flex items-center gap-2 font-bold text-sm no-drag mr-4">
             <Box className="w-4 h-4 text-uml-class-border fill-uml-class-bg/20" />
             <span className="text-text-primary tracking-tight hidden sm:block">LibreUML</span>
          </div>

          <div className="flex items-center h-full no-drag">
              <FileMenu actions={actions} />
              <SettingsMenu />
          </div>
        </div>

        {/* CENTER: Title */}
        <div className="absolute left-1/2 -translate-x-1/2 text-xs text-text-muted hidden md:flex items-center gap-2 pointer-events-none">
          <span>{diagramName}.luml</span>
          {isDirty && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved" />}
        </div>

        {/* RIGHT: Window Controls */}
        <WindowControls />
      </header>

      {/* --- MODALES --- */}

      {/* COMPLEX Modal (Save/Discard) */}
      <UnsavedChangesModal 
        isOpen={modals.unsaved.isOpen}
        fileName={modals.unsaved.fileName}
        onDiscard={modals.unsaved.onDiscard}
        onSave={modals.unsaved.onSave}
        onCancel={modals.unsaved.onCancel}
      />

      {/*SIMPLE Modal (YES/No) */}
      <ConfirmationModal
        isOpen={modals.confirmation.isOpen}
        title={modals.confirmation.title}
        message={modals.confirmation.message}
        onConfirm={modals.confirmation.onConfirm}
        onCancel={modals.confirmation.onCancel}
      />
    </>
  );
}