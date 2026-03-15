import { X, FileText } from "lucide-react";
import { useWorkspaceStore } from "../../../store/workspace.store";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import UnsavedChangesModal from "../../diagram/components/modals/UnsavedChangesModal";

export default function TabBar() {
  const { t } = useTranslation();
  const files = useWorkspaceStore((s) => s.files);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const switchFile = useWorkspaceStore((s) => s.switchFile); // PHASE 9.5: Use switchFile for freeze/hydrate
  const removeFile = useWorkspaceStore((s) => s.removeFile);
  const getFile = useWorkspaceStore((s) => s.getFile);

  const [closingFileId, setClosingFileId] = useState<string | null>(null);

  const getDiagramIcon = (diagramType: string) => {
    // For now, use a generic file icon. Can be extended with specific icons per diagram type
    return <FileText className="w-4 h-4" />;
  };

  const handleTabClick = (fileId: string) => {
    switchFile(fileId); // PHASE 9.5: Triggers freeze/hydrate sequence
  };

  const handleCloseClick = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    
    const file = getFile(fileId);
    if (!file) return;

    // If file is dirty, show unsaved changes modal
    if (file.isDirty) {
      setClosingFileId(fileId);
    } else {
      // If not dirty, close immediately
      removeFile(fileId);
    }
  };

  const handleDiscardAndClose = () => {
    if (closingFileId) {
      removeFile(closingFileId);
      setClosingFileId(null);
    }
  };

  const handleSaveAndClose = async () => {
    if (closingFileId) {
      // TODO: Implement save logic when save functionality is available
      // For now, just mark as clean and close
      removeFile(closingFileId);
      setClosingFileId(null);
    }
  };

  const handleCancelClose = () => {
    setClosingFileId(null);
  };

  const closingFile = closingFileId ? getFile(closingFileId) : null;

  if (files.length === 0) return null;

  return (
    <>
      <div className="h-9 w-full bg-surface-secondary border-b border-surface-border flex items-center overflow-x-auto select-none shrink-0">
        {files.map((file) => {
          const isActive = file.id === activeFileId;
          
          return (
            <div
              key={file.id}
              onClick={() => handleTabClick(file.id)}
              className={`
                h-full flex items-center gap-2 px-3 border-r border-surface-border cursor-pointer
                transition-colors min-w-fit max-w-[200px]
                ${isActive 
                  ? "bg-surface-primary text-text-primary border-t-2 border-t-blue-500" 
                  : "bg-surface-secondary text-text-secondary hover:bg-surface-hover"
                }
              `}
            >
              <div className={`flex-shrink-0 ${isActive ? "text-blue-400" : "text-text-muted"}`}>
                {getDiagramIcon(file.diagramType)}
              </div>
              
              <span className="text-xs font-medium truncate">
                {file.name}
              </span>

              {file.isDirty && (
                <span className="flex-shrink-0 text-white text-base leading-none" title={t("tabBar.unsavedChanges")}>
                  •
                </span>
              )}

              <button
                onClick={(e) => handleCloseClick(e, file.id)}
                className={`
                  flex-shrink-0 ml-auto p-0.5 rounded hover:bg-surface-hover transition-colors
                  ${isActive ? "text-text-secondary hover:text-text-primary" : "text-text-muted hover:text-text-secondary"}
                `}
                title={t("tabBar.closeTab")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Unsaved Changes Modal for Tab Closing */}
      <UnsavedChangesModal
        isOpen={!!closingFileId}
        fileName={closingFile?.name || ""}
        onDiscard={handleDiscardAndClose}
        onSave={handleSaveAndClose}
        onCancel={handleCancelClose}
      />
    </>
  );
}
