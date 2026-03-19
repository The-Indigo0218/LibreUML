import { useState, useEffect, useRef } from "react";
import {
  FolderTree,
  FileText,
  ChevronDown,
  ChevronRight,
  PlusSquare,
  FolderPlus,
  Folder,
  FolderOpen,
  LayoutTemplate,
  Trash2,
  Edit2,
  Info,
  Edit3,
  List,
} from "lucide-react";
import { useVFSStore } from "../../../../store/vfs.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useModelStore } from "../../../../store/model.store";
import CreateFileModal from "./CreateFileModal";
import CreateFolderModal from "./CreateFolderModal";
import ViewDescriptionModal from "./ViewDescriptionModal";
import type { VFSFolder, VFSFile } from "../../../../core/domain/vfs/vfs.types";

type VFSNode = VFSFolder | VFSFile;

// ─── Type badge (VS Code–style inline symbol kind indicator) ─────────────────

function ElementBadge({
  kind,
  isAbstract,
}: {
  kind: "CLASS" | "INTERFACE" | "ENUM";
  isAbstract?: boolean;
}) {
  if (kind === "CLASS" && isAbstract) {
    return (
      <span className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold bg-indigo-400/10 text-indigo-400 shrink-0">
        A
      </span>
    );
  }
  if (kind === "CLASS") {
    return (
      <span className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold bg-blue-400/10 text-blue-400 shrink-0">
        C
      </span>
    );
  }
  if (kind === "INTERFACE") {
    return (
      <span className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold bg-violet-400/10 text-violet-400 shrink-0">
        I
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold bg-amber-400/10 text-amber-400 shrink-0">
      E
    </span>
  );
}

// ─── Context menu state ───────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeName: string;
  isFolder: boolean;
}

// ─── TreeItem ─────────────────────────────────────────────────────────────────

interface TreeItemProps {
  node: VFSNode;
  level: number;
  expandedFolders: Set<string>;
  editingNodeId: string | null;
  editValue: string;
  onToggleFolder: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, node: VFSNode) => void;
  onEditChange: (value: string) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
  onInlineNewFile: (folderId: string) => void;
  onInlineNewFolder: (folderId: string) => void;
  onOpenFile: (fileId: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function TreeItem({
  node,
  level,
  expandedFolders,
  editingNodeId,
  editValue,
  onToggleFolder,
  onContextMenu,
  onEditChange,
  onEditCommit,
  onEditCancel,
  onInlineNewFile,
  onInlineNewFolder,
  onOpenFile,
  inputRef,
}: TreeItemProps) {
  const { project } = useVFSStore();
  const isExpanded = expandedFolders.has(node.id);
  const isEditing = editingNodeId === node.id;
  const paddingLeft = level * 16 + 8;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEditCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onEditCancel();
    }
  };

  if (node.type === "FOLDER") {
    const children = project?.nodes
      ? Object.values(project.nodes)
          .filter(
            (n) =>
              n.parentId === node.id &&
              !(n.type === "FILE" && (n as VFSFile).extension === ".model"),
          )
          .sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === "FOLDER" ? -1 : 1;
          })
      : [];

    return (
      <div>
        <div
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-hover transition-colors cursor-pointer group"
          style={{ paddingLeft: `${paddingLeft}px` }}
          onContextMenu={(e) => onContextMenu(e, node)}
        >
          {isEditing ? (
            <>
              <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => onEditChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={onEditCommit}
                className="flex-1 bg-surface-secondary border border-blue-500 rounded px-1 py-0.5 text-xs text-text-primary focus:outline-none"
              />
            </>
          ) : (
            <>
              <button
                onClick={() => onToggleFolder(node.id)}
                className="shrink-0 hover:bg-surface-secondary rounded p-0.5"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-text-muted" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-text-muted" />
                )}
              </button>
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              )}
              <span className="text-xs text-text-secondary group-hover:text-text-primary truncate flex-1">
                {node.name}
              </span>
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 ml-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInlineNewFile(node.id);
                  }}
                  className="p-0.5 hover:bg-surface-secondary rounded transition-colors"
                  title="New File"
                >
                  <PlusSquare className="w-3.5 h-3.5 text-text-muted hover:text-text-primary" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInlineNewFolder(node.id);
                  }}
                  className="p-0.5 hover:bg-surface-secondary rounded transition-colors"
                  title="New Folder"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-text-muted hover:text-text-primary" />
                </button>
              </div>
            </>
          )}
        </div>
        {isExpanded && (
          <div className="ml-3 pl-1 border-l border-surface-border/50">
            {children.map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                level={level + 1}
                expandedFolders={expandedFolders}
                editingNodeId={editingNodeId}
                editValue={editValue}
                onToggleFolder={onToggleFolder}
                onContextMenu={onContextMenu}
                onEditChange={onEditChange}
                onEditCommit={onEditCommit}
                onEditCancel={onEditCancel}
                onInlineNewFile={onInlineNewFile}
                onInlineNewFolder={onInlineNewFolder}
                onOpenFile={onOpenFile}
                inputRef={inputRef}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── File row ──────────────────────────────────────────────────────────────
  const isLuml = (node as VFSFile).extension === ".luml";
  const FileIcon = isLuml ? LayoutTemplate : FileText;
  const fileIconCls = isLuml
    ? "w-3.5 h-3.5 text-purple-400 shrink-0"
    : "w-3.5 h-3.5 text-text-muted shrink-0";

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-hover transition-colors cursor-pointer group"
      style={{ paddingLeft: `${paddingLeft + 20}px` }}
      onContextMenu={(e) => onContextMenu(e, node)}
      onDoubleClick={() => onOpenFile(node.id)}
    >
      {isEditing ? (
        <>
          <FileIcon className={fileIconCls} />
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onEditCommit}
            className="flex-1 bg-surface-secondary border border-blue-500 rounded px-1 py-0.5 text-xs text-text-primary focus:outline-none"
          />
        </>
      ) : (
        <>
          <FileIcon className={fileIconCls} />
          <span className="text-xs text-text-secondary group-hover:text-text-primary truncate">
            {node.name}
          </span>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProjectStructure() {
  const { project, deleteNode, renameNode } = useVFSStore();
  const { openTab } = useWorkspaceStore();
  const model = useModelStore((s) => s.model);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isNewNode, setIsNewNode] = useState(false);
  const [isCreateFileModalOpen, setIsCreateFileModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isViewDescriptionModalOpen, setIsViewDescriptionModalOpen] = useState(false);
  const [editFileNodeId, setEditFileNodeId] = useState<string | undefined>(undefined);
  const [editFolderNodeId, setEditFolderNodeId] = useState<string | undefined>(undefined);
  const [viewDescriptionNode, setViewDescriptionNode] = useState<{ name: string; description: string } | null>(null);
  const [createFileParentId, setCreateFileParentId] = useState<string | null>(null);
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);
  const [isOutlineExpanded, setIsOutlineExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Outline data (derived from SemanticModel) ──────────────────────────────
  const classes = model
    ? Object.values(model.classes).sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const interfaces = model
    ? Object.values(model.interfaces).sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const enums = model
    ? Object.values(model.enums).sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const outlineCount = classes.length + interfaces.length + enums.length;

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  useEffect(() => {
    if (editingNodeId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingNodeId]);

  const handleNewFileAtRoot = () => {
    setCreateFileParentId(null);
    setEditFileNodeId(undefined);
    setIsCreateFileModalOpen(true);
  };

  const handleNewFolderAtRoot = () => {
    setCreateFolderParentId(null);
    setEditFolderNodeId(undefined);
    setIsCreateFolderModalOpen(true);
  };

  const handleToggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, node: VFSNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      nodeId: node.id,
      nodeName: node.name,
      isFolder: node.type === "FOLDER",
    });
  };

  const handleRename = () => {
    if (!contextMenu) return;
    setEditingNodeId(contextMenu.nodeId);
    setEditValue(contextMenu.nodeName);
    setIsNewNode(false);
    setContextMenu(null);
  };

  const handleEditDetails = () => {
    if (!contextMenu) return;
    if (contextMenu.isFolder) {
      setEditFolderNodeId(contextMenu.nodeId);
      setIsCreateFolderModalOpen(true);
    } else {
      setEditFileNodeId(contextMenu.nodeId);
      setIsCreateFileModalOpen(true);
    }
    setContextMenu(null);
  };

  const handleViewDescription = () => {
    if (!contextMenu || !project) return;
    const node = project.nodes[contextMenu.nodeId];
    if (node) {
      setViewDescriptionNode({
        name: node.name,
        description: node.description || "",
      });
      setIsViewDescriptionModalOpen(true);
    }
    setContextMenu(null);
  };

  const handleDelete = () => {
    if (!contextMenu) return;
    deleteNode(contextMenu.nodeId);
    setContextMenu(null);
  };

  const handleNewFileInside = () => {
    if (!contextMenu) return;
    setCreateFileParentId(contextMenu.nodeId);
    setEditFileNodeId(undefined);
    setIsCreateFileModalOpen(true);
    setExpandedFolders((prev) => new Set(prev).add(contextMenu.nodeId));
    setContextMenu(null);
  };

  const handleNewFolderInside = () => {
    if (!contextMenu) return;
    setCreateFolderParentId(contextMenu.nodeId);
    setEditFolderNodeId(undefined);
    setIsCreateFolderModalOpen(true);
    setExpandedFolders((prev) => new Set(prev).add(contextMenu.nodeId));
    setContextMenu(null);
  };

  const handleInlineNewFile = (folderId: string) => {
    setCreateFileParentId(folderId);
    setEditFileNodeId(undefined);
    setIsCreateFileModalOpen(true);
    setExpandedFolders((prev) => new Set(prev).add(folderId));
  };

  const handleOpenFile = (fileId: string) => {
    openTab(fileId);
  };

  const handleInlineNewFolder = (folderId: string) => {
    setCreateFolderParentId(folderId);
    setEditFolderNodeId(undefined);
    setIsCreateFolderModalOpen(true);
    setExpandedFolders((prev) => new Set(prev).add(folderId));
  };

  const commitEdit = () => {
    if (!editValue.trim()) {
      if (isNewNode && editingNodeId) {
        deleteNode(editingNodeId);
      }
      setEditingNodeId(null);
      setIsNewNode(false);
      return;
    }

    if (editingNodeId) {
      renameNode(editingNodeId, editValue.trim());
    }

    setEditingNodeId(null);
    setIsNewNode(false);
  };

  const cancelEdit = () => {
    if (isNewNode && editingNodeId) {
      deleteNode(editingNodeId);
    }
    setEditingNodeId(null);
    setIsNewNode(false);
    setEditValue("");
  };

  // ── No project state ───────────────────────────────────────────────────────

  if (!project || !project.nodes) {
    return (
      <div className="flex flex-col h-full bg-surface-primary overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border shrink-0">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-text-muted" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Project Files
            </h3>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="text-center">
            <FolderTree className="w-12 h-12 text-text-muted/30 mx-auto mb-3" />
            <p className="text-sm text-text-muted">No project active</p>
          </div>
        </div>
      </div>
    );
  }

  const rootNodes = Object.values(project.nodes)
    .filter(
      (n) =>
        n.parentId === null &&
        !(n.type === "FILE" && (n as VFSFile).extension === ".model"),
    )
    .sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "FOLDER" ? -1 : 1;
    });

  return (
    <div className="flex flex-col h-full bg-surface-primary overflow-hidden">

      {/* ── File Tree ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-text-muted" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Project Files
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewFileAtRoot}
              className="p-1 hover:bg-surface-hover rounded transition-colors"
              title="New File"
            >
              <PlusSquare className="w-3.5 h-3.5 text-text-muted hover:text-text-primary" />
            </button>
            <button
              onClick={handleNewFolderAtRoot}
              className="p-1 hover:bg-surface-hover rounded transition-colors"
              title="New Folder"
            >
              <FolderPlus className="w-3.5 h-3.5 text-text-muted hover:text-text-primary" />
            </button>
          </div>
        </div>

        {/* Tree body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
          {rootNodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FolderTree className="w-12 h-12 text-text-muted/30 mx-auto mb-3" />
                <p className="text-sm text-text-muted">Empty project</p>
                <p className="text-xs text-text-muted/70 mt-1">
                  Add files and folders to begin
                </p>
              </div>
            </div>
          ) : (
            rootNodes.map((node) => (
              <TreeItem
                key={node.id}
                node={node}
                level={0}
                expandedFolders={expandedFolders}
                editingNodeId={editingNodeId}
                editValue={editValue}
                onToggleFolder={handleToggleFolder}
                onContextMenu={handleContextMenu}
                onEditChange={setEditValue}
                onEditCommit={commitEdit}
                onEditCancel={cancelEdit}
                onInlineNewFile={handleInlineNewFile}
                onInlineNewFolder={handleInlineNewFolder}
                onOpenFile={handleOpenFile}
                inputRef={inputRef}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Outline Panel ────────────────────────────────────────────────── */}
      <div className="flex flex-col shrink-0 border-t border-surface-border">
        {/* Outline header — always visible, click to collapse/expand */}
        <button
          className="flex items-center justify-between px-4 py-2 w-full hover:bg-surface-hover transition-colors group"
          onClick={() => setIsOutlineExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <List className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted group-hover:text-text-primary transition-colors">
              Outline
            </span>
            {outlineCount > 0 && (
              <span className="text-[10px] text-text-muted/60 tabular-nums">
                ({outlineCount})
              </span>
            )}
          </div>
          {isOutlineExpanded ? (
            <ChevronDown className="w-3 h-3 text-text-muted" />
          ) : (
            <ChevronRight className="w-3 h-3 text-text-muted" />
          )}
        </button>

        {/* Outline body */}
        {isOutlineExpanded && (
          <div className="overflow-y-auto custom-scrollbar max-h-52 pb-1">
            {outlineCount === 0 ? (
              <p className="px-4 py-3 text-xs text-text-muted/60 italic">
                No elements in model
              </p>
            ) : (
              <>
                {/* Classes */}
                {classes.length > 0 && (
                  <div>
                    <div className="px-4 pt-2 pb-0.5 text-[10px] font-medium text-text-muted/50 uppercase tracking-wider">
                      Classes
                    </div>
                    {classes.map((cls) => (
                      <div
                        key={cls.id}
                        className="flex items-center gap-2 px-4 py-1 hover:bg-surface-hover transition-colors"
                        title={cls.isAbstract ? `${cls.name} (abstract)` : cls.name}
                      >
                        <ElementBadge kind="CLASS" isAbstract={cls.isAbstract} />
                        <span
                          className={`text-xs truncate ${
                            cls.isAbstract
                              ? "italic text-text-muted"
                              : "text-text-secondary"
                          }`}
                        >
                          {cls.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Interfaces */}
                {interfaces.length > 0 && (
                  <div>
                    <div className="px-4 pt-2 pb-0.5 text-[10px] font-medium text-text-muted/50 uppercase tracking-wider">
                      Interfaces
                    </div>
                    {interfaces.map((iface) => (
                      <div
                        key={iface.id}
                        className="flex items-center gap-2 px-4 py-1 hover:bg-surface-hover transition-colors"
                        title={iface.name}
                      >
                        <ElementBadge kind="INTERFACE" />
                        <span className="text-xs text-text-secondary truncate">
                          {iface.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Enums */}
                {enums.length > 0 && (
                  <div>
                    <div className="px-4 pt-2 pb-0.5 text-[10px] font-medium text-text-muted/50 uppercase tracking-wider">
                      Enums
                    </div>
                    {enums.map((enm) => (
                      <div
                        key={enm.id}
                        className="flex items-center gap-2 px-4 py-1 hover:bg-surface-hover transition-colors"
                        title={enm.name}
                      >
                        <ElementBadge kind="ENUM" />
                        <span className="text-xs text-text-secondary truncate">
                          {enm.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Context menu ─────────────────────────────────────────────────── */}
      {contextMenu && (
        <div
          className="fixed bg-surface-secondary border border-surface-border rounded-md shadow-lg py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.isFolder && (
            <>
              <button
                onClick={() => {
                  openTab(contextMenu.nodeId);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary flex items-center gap-2"
              >
                <FileText className="w-3 h-3" />
                Open File
              </button>
              <div className="border-t border-surface-border my-1" />
            </>
          )}
          <button
            onClick={handleRename}
            className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary flex items-center gap-2"
          >
            <Edit2 className="w-3 h-3" />
            Rename
          </button>
          <button
            onClick={handleEditDetails}
            className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary flex items-center gap-2"
          >
            <Edit3 className="w-3 h-3" />
            Edit Details
          </button>
          <button
            onClick={handleViewDescription}
            className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary flex items-center gap-2"
          >
            <Info className="w-3 h-3" />
            View Description
          </button>
          {contextMenu.isFolder && (
            <>
              <button
                onClick={handleNewFileInside}
                className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary flex items-center gap-2"
              >
                <PlusSquare className="w-3 h-3" />
                New File inside
              </button>
              <button
                onClick={handleNewFolderInside}
                className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary flex items-center gap-2"
              >
                <FolderPlus className="w-3 h-3" />
                New Folder inside
              </button>
              <div className="border-t border-surface-border my-1" />
            </>
          )}
          <button
            onClick={handleDelete}
            className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-surface-hover flex items-center gap-2"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      )}

      <CreateFileModal
        isOpen={isCreateFileModalOpen}
        onClose={() => {
          setIsCreateFileModalOpen(false);
          setEditFileNodeId(undefined);
        }}
        parentId={createFileParentId}
        editNodeId={editFileNodeId}
      />

      <CreateFolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => {
          setIsCreateFolderModalOpen(false);
          setEditFolderNodeId(undefined);
        }}
        parentId={createFolderParentId}
        editNodeId={editFolderNodeId}
      />

      <ViewDescriptionModal
        isOpen={isViewDescriptionModalOpen}
        onClose={() => {
          setIsViewDescriptionModalOpen(false);
          setViewDescriptionNode(null);
        }}
        nodeName={viewDescriptionNode?.name || ""}
        description={viewDescriptionNode?.description || ""}
      />
    </div>
  );
}
