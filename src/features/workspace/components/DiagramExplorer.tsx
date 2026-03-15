import { useState, useRef, useEffect } from "react";
import { FileText, Plus, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "../../../store/workspace.store";
import { useUiStore } from "../../../store/uiStore";
import type { DiagramType } from "../../../core/domain/workspace/diagram-file.types";

export default function DiagramExplorer() {
  const { t } = useTranslation();
  const files = useWorkspaceStore((s) => s.files);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const switchFile = useWorkspaceStore((s) => s.switchFile); // PHASE 9.5: Use switchFile for freeze/hydrate
  const removeFile = useWorkspaceStore((s) => s.removeFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const openCreateDiagram = useUiStore((s) => s.openCreateDiagram);

  const [contextMenu, setContextMenu] = useState<{
    fileId: string;
    x: number;
    y: number;
  } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingId]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const getDiagramIcon = (diagramType: DiagramType) => {
    // Future: Add specific icons per diagram type
    return <FileText className="w-4 h-4" />;
  };

  const handleDoubleClick = (fileId: string) => {
    switchFile(fileId); // PHASE 9.5: Triggers freeze/hydrate sequence
  };

  const handleContextMenu = (e: React.MouseEvent, fileId: string) => {
    e.preventDefault();
    setContextMenu({ fileId, x: e.clientX, y: e.clientY });
  };

  const handleRename = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (file) {
      setRenamingId(fileId);
      setRenameValue(file.name);
    }
    setContextMenu(null);
  };

  const handleRenameSubmit = () => {
    if (renamingId && renameValue.trim()) {
      updateFile(renamingId, { name: renameValue.trim() });
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setRenamingId(null);
      setRenameValue("");
    }
  };

  const handleDelete = (fileId: string) => {
    if (confirm(t("diagramExplorer.confirmDelete"))) {
      removeFile(fileId);
    }
    setContextMenu(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {t("diagramExplorer.title")}
        </h3>
        <button
          onClick={openCreateDiagram}
          className="p-1 hover:bg-surface-hover rounded transition-colors text-text-muted hover:text-text-primary"
          title={t("diagramExplorer.createNew")}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Diagram List */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="p-4 text-center text-text-muted text-xs">
            {t("diagramExplorer.empty")}
          </div>
        ) : (
          <div className="py-1">
            {files.map((file) => {
              const isActive = file.id === activeFileId;
              const isRenaming = renamingId === file.id;

              return (
                <div
                  key={file.id}
                  onDoubleClick={() => handleDoubleClick(file.id)}
                  onContextMenu={(e) => handleContextMenu(e, file.id)}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors
                    ${isActive 
                      ? "bg-blue-500/20 text-text-primary border-l-2 border-blue-500" 
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    }
                  `}
                >
                  <div className={`flex-shrink-0 ${isActive ? "text-blue-400" : "text-text-muted"}`}>
                    {getDiagramIcon(file.diagramType)}
                  </div>

                  {isRenaming ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameSubmit}
                      onKeyDown={handleRenameKeyDown}
                      className="flex-1 px-1 py-0 bg-surface-secondary border border-blue-500 rounded text-xs text-text-primary focus:outline-none"
                    />
                  ) : (
                    <>
                      <span className="flex-1 text-xs truncate">{file.name}</span>
                      {file.isDirty && (
                        <span className="flex-shrink-0 text-white text-sm leading-none">
                          •
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-surface-primary border border-surface-border rounded-md shadow-xl py-1 z-[200] min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleRename(contextMenu.fileId)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{t("diagramExplorer.rename")}</span>
          </button>
          <button
            onClick={() => handleDelete(contextMenu.fileId)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t("diagramExplorer.delete")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
