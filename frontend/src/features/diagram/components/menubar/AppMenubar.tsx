import { Box } from "lucide-react";
import { useDiagramStore } from "../../../../store/diagramStore";
import WindowControls from "../../../../components/ui/menubar/WindowControls"; 
import { useDiagramActions } from "../../hooks/useDiagramActions";
import UnsavedChangesModal from "../modals/UnsavedChangesModal";

// Modules
import { FileMenu } from "./modules/FileMenu";
import { SettingsMenu } from "./modules/SettingsMenu"; 

export default function AppMenubar() {
  const diagramName = useDiagramStore((s) => s.diagramName);
  const isDirty = useDiagramStore((s) => s.isDirty);
  
  const actions = useDiagramActions(); 
  const { modalState } = actions;

  return (
    <>
      <header className="h-10 w-full bg-surface-primary border-b border-surface-border flex items-center justify-between select-none drag-region pl-3 pr-0 z-50 shrink-0">
        
        {/* LEFT: Logo + Menus */}
        <div className="flex items-center gap-1 h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 font-bold text-sm no-drag mr-4">
             <Box className="w-4 h-4 text-uml-class-border fill-uml-class-bg/20" />
             <span className="text-text-primary tracking-tight hidden sm:block">LibreUML</span>
          </div>

          {/* Menus */}
          <div className="flex items-center h-full no-drag">
              <FileMenu actions={actions} />
              
              {/* Edit / View placeholders... */}
              
              <SettingsMenu />
              
              <button className="px-3 py-1 text-xs text-text-secondary hover:bg-surface-hover rounded transition-colors cursor-not-allowed opacity-50">Help</button>
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

      {/* Global Modals */}
      <UnsavedChangesModal 
        isOpen={modalState.isOpen}
        fileName={modalState.fileName}
        onDiscard={modalState.onDiscard}
        onSave={modalState.onSave}
        onCancel={modalState.close}
      />
    </>
  );
}