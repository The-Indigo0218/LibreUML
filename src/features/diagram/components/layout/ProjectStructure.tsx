import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FolderTree, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { FileContextMenu } from "./projectStructure/FileContextMenu";

interface FileContextMenuState {
  x: number;
  y: number;
  fileId: string;
  fileName: string;
  isOutlineFile: boolean;
}

export default function ProjectStructure() {
  const { t } = useTranslation();
  const files = useWorkspaceStore((s) => s.files);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const removeFile = useWorkspaceStore((s) => s.removeFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);

  const [isOutlineExpanded, setIsOutlineExpanded] = useState(true);
  const [contextMenu, setContextMenu] = useState<FileContextMenuState | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  useEffect(() => {
    if (renamingFileId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingFileId]);

  const handleFileContextMenu = (e: React.MouseEvent, fileId: string, fileName: string, isOutlineFile: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      fileId,
      fileName,
      isOutlineFile,
    });
  };

  const handleRename = () => {
    if (!contextMenu) return;
    setRenamingFileId(contextMenu.fileId);
    setRenameValue(contextMenu.fileName);
    setContextMenu(null);
  };

  const handleDelete = () => {
    if (!contextMenu) return;
    removeFile(contextMenu.fileId);
    setContextMenu(null);
  };

  const handleOpen = () => {
    if (!contextMenu) return;
    setActiveFile(contextMenu.fileId);
    setContextMenu(null);
  };

  const handleAddToProject = () => {
    if (!contextMenu) return;
    setContextMenu(null);
  };

  const commitRename = () => {
    if (!renamingFileId || !renameValue.trim()) {
      setRenamingFileId(null);
      return;
    }
    
    updateFile(renamingFileId, { name: renameValue.trim() });
    setRenamingFileId(null);
  };

  const cancelRename = () => {
    setRenamingFileId(null);
    setRenameValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  };

  const outlineHeight = isOutlineExpanded && files.length > 0 ? "33%" : "auto";

  return (
    <div className="flex flex-col h-full bg-surface-primary">
      <div className="px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-text-muted" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {t('sidebar.project_structure')}
          </h3>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <button
            onClick={() => {}}
            className="flex items-center justify-between px-4 py-2 border-b border-surface-border hover:bg-surface-hover transition-colors"
          >
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {t('sidebar.project_files')}
            </h4>
            <ChevronDown className="w-3 h-3 text-text-muted" />
          </button>
          <div className="flex-1 p-4 flex items-center justify-center overflow-y-auto custom-scrollbar">
            <div className="text-center">
              <FolderTree className="w-12 h-12 text-text-muted/30 mx-auto mb-3" />
              <p className="text-sm text-text-muted">File tree coming soon</p>
              <p className="text-xs text-text-muted/70 mt-1">
                Project folder navigation
              </p>
            </div>
          </div>
        </div>

        <div 
          className="border-t border-surface-border flex flex-col"
          style={{ 
            height: outlineHeight,
            minHeight: isOutlineExpanded ? "100px" : "auto"
          }}
        >
          <button
            onClick={() => setIsOutlineExpanded(!isOutlineExpanded)}
            className="flex items-center justify-between px-4 py-2 border-b border-surface-border hover:bg-surface-hover transition-colors"
          >
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {t('sidebar.outline')}
            </h4>
            {isOutlineExpanded ? (
              <ChevronDown className="w-3 h-3 text-text-muted" />
            ) : (
              <ChevronRight className="w-3 h-3 text-text-muted" />
            )}
          </button>
          
          {isOutlineExpanded && (
            <div className="flex-1 px-2 py-2 overflow-y-auto custom-scrollbar">
              {files.length === 0 ? (
                <div className="px-2 py-4 text-center">
                  <p className="text-xs text-text-muted">No open files</p>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className={`
                        flex items-center gap-2 px-2 py-1.5 rounded transition-colors
                        ${activeFileId === file.id 
                          ? 'bg-surface-hover text-text-primary' 
                          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                        }
                      `}
                      style={{ opacity: 0.8 }}
                    >
                      {renamingFileId === file.id ? (
                        <>
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <input
                            ref={inputRef}
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={commitRename}
                            className="flex-1 bg-surface-secondary border border-blue-500 rounded px-1 py-0.5 text-xs text-text-primary focus:outline-none"
                          />
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setActiveFile(file.id)}
                            onContextMenu={(e) => handleFileContextMenu(e, file.id, file.name, true)}
                            className="flex items-center gap-2 flex-1 text-left"
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-xs truncate">{file.name}</span>
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <FileContextMenu
        contextMenu={contextMenu}
        onRename={handleRename}
        onDelete={handleDelete}
        onOpen={handleOpen}
        onAddToProject={handleAddToProject}
      />
    </div>
  );
}
