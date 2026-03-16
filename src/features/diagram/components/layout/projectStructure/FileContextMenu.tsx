import { Edit2, Trash2, ExternalLink, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FileContextMenuState {
  x: number;
  y: number;
  fileId: string;
  fileName: string;
  isOutlineFile: boolean;
}

interface FileContextMenuProps {
  contextMenu: FileContextMenuState | null;
  onRename: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onAddToProject: () => void;
}

export function FileContextMenu({ 
  contextMenu, 
  onRename, 
  onDelete,
  onOpen,
  onAddToProject
}: FileContextMenuProps) {
  const { t } = useTranslation();
  
  if (!contextMenu) return null;

  return (
    <div
      className="fixed bg-surface-secondary border border-surface-border rounded-lg shadow-2xl py-1 z-50 min-w-[160px]"
      style={{ 
        left: `${contextMenu.x}px`, 
        top: `${contextMenu.y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {contextMenu.isOutlineFile && (
        <button
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
          onClick={onAddToProject}
        >
          <Plus className="w-4 h-4 text-green-400" />
          <span>{t('actions.addToProject')}</span>
        </button>
      )}
      
      <button
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
        onClick={onOpen}
      >
        <ExternalLink className="w-4 h-4 text-blue-400" />
        <span>{t('actions.open')}</span>
      </button>
      
      <button
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
        onClick={onRename}
      >
        <Edit2 className="w-4 h-4 text-blue-400" />
        <span>{t('actions.rename')}</span>
      </button>
      
      <button
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-surface-hover transition-colors"
        onClick={onDelete}
      >
        <Trash2 className="w-4 h-4" />
        <span>{t('actions.delete')}</span>
      </button>
    </div>
  );
}
