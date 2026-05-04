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
  PanelLeftClose,
  ExternalLink,
  Unlink,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { useModelStore } from "../../../../store/model.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useLayoutStore } from "../../../../store/layout.store";
import { useToastStore } from "../../../../store/toast.store";
import CreateFileModal from "./CreateFileModal";
import CreateFolderModal from "./CreateFolderModal";
import ViewDescriptionModal from "./ViewDescriptionModal";
import type { VFSFolder, VFSFile, DiagramView, SemanticModel } from "../../../../core/domain/vfs/vfs.types";

type VFSNode = VFSFolder | VFSFile;


interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeName: string;
  isFolder: boolean;
  isExternal?: boolean;
  isStandalone?: boolean;
  isLuml?: boolean;
}
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
              !(n.type === "FILE" && (n as VFSFile).extension === ".model") &&
              !(n.type === "FILE" && (n as VFSFile).standalone === true),
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
  const isStandaloneFile = isLuml && (node as VFSFile).standalone === true;
  const FileIcon = isLuml ? LayoutTemplate : FileText;
  const fileIconCls = isStandaloneFile
    ? "w-3.5 h-3.5 text-amber-400 shrink-0"
    : isLuml
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
          <span className="text-xs text-text-secondary group-hover:text-text-primary truncate flex-1">
            {node.name}
          </span>
          {isStandaloneFile && (
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-amber-500/80 bg-amber-500/10 border border-amber-500/20 rounded px-1 py-px leading-none">
              solo
            </span>
          )}
        </>
      )}
    </div>
  );
}

export default function ProjectStructure() {
  const { t } = useTranslation();
  const { project, deleteNode, renameNode, updateNode: updateVFSNode } = useVFSStore();
  const { openTab } = useWorkspaceStore();
  const { toggleLeftPanel } = useLayoutStore();

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
  const [isStandaloneExpanded, setIsStandaloneExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

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
      isExternal: node.type === "FILE" && (node as VFSFile).isExternal === true,
      isStandalone: node.type === "FILE" && (node as VFSFile).standalone === true,
      isLuml: node.type === "FILE" && (node as VFSFile).extension === ".luml",
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
    const deletedNode = project?.nodes[contextMenu.nodeId];
    deleteNode(contextMenu.nodeId);
    setContextMenu(null);
    if (deletedNode) {
      useToastStore.getState().show(`"${deletedNode.name}" deleted`);
    }
  };

  const handleAddFileToProject = () => {
    if (!contextMenu || !project) return;
    const file = project.nodes[contextMenu.nodeId] as VFSFile;
    if (!file || file.type !== "FILE") return;

    updateVFSNode(contextMenu.nodeId, { parentId: null, isExternal: false } as Partial<VFSFile>);

    const diagramView = file.content as DiagramView | null;
    if (diagramView?.nodes) {
      const ms = useModelStore.getState();
      diagramView.nodes.forEach((vn) => {
        if (vn.elementId) ms.integrateExternalElement(vn.elementId);
      });
    }

    useToastStore.getState().show(`"${file.name}" and all its classes added to project`);
    setContextMenu(null);
  };

  /**
   * Eject lifecycle: converts a project .luml file to standalone mode.
   *
   * Deep-clones all IR elements referenced in the file's DiagramView into
   * a new per-file localModel with fresh UUIDs. The DiagramView is remapped
   * to point at the new local IDs. Original elements stay in the global model.
   */
  const handleMakeStandalone = () => {
    if (!contextMenu || !project) return;
    const file = project.nodes[contextMenu.nodeId] as VFSFile;
    if (!file || file.type !== "FILE") return;

    const ms = useModelStore.getState();
    const view = file.content as DiagramView | null;

    if (!ms.model || !view || !('nodes' in view)) {
      // No global model or no valid DiagramView — seed empty localModel and flip flag.
      useVFSStore.getState().updateNode(contextMenu.nodeId, {
        standalone: true,
        localModel: null,
      } as Partial<VFSFile>);
      useVFSStore.getState().initLocalModel(contextMenu.nodeId);
      useToastStore.getState().show(`"${file.name}" is now standalone`);
      setContextMenu(null);
      return;
    }

    const globalModel = ms.model;
    const elementIds = new Set<string>();
    (view as DiagramView).nodes.forEach((vn) => { if (vn.elementId) elementIds.add(vn.elementId); });

    const now = Date.now();
    const newLocalModel: SemanticModel = {
      id: crypto.randomUUID(),
      name: `${file.name} (standalone)`,
      version: '1.0.0',
      packages: {},
      classes: {},
      interfaces: {},
      enums: {},
      dataTypes: {},
      attributes: {},
      operations: {},
      actors: {},
      useCases: {},
      activityNodes: {},
      objectInstances: {},
      components: {},
      nodes: {},
      artifacts: {},
      relations: {},
      createdAt: now,
      updatedAt: now,
    };

    // Map: old global element ID → new local element ID
    const elementIdMap = new Map<string, string>();

    for (const oldId of elementIds) {
      const newId = crypto.randomUUID();
      elementIdMap.set(oldId, newId);

      const cls = globalModel.classes[oldId];
      if (cls) {
        const newAttrIds: string[] = [];
        for (const attrId of cls.attributeIds) {
          const attr = globalModel.attributes[attrId];
          if (attr) {
            const newAttrId = crypto.randomUUID();
            newLocalModel.attributes[newAttrId] = { ...attr, id: newAttrId };
            newAttrIds.push(newAttrId);
          }
        }
        const newOpIds: string[] = [];
        for (const opId of cls.operationIds) {
          const op = globalModel.operations[opId];
          if (op) {
            const newOpId = crypto.randomUUID();
            newLocalModel.operations[newOpId] = { ...op, id: newOpId };
            newOpIds.push(newOpId);
          }
        }
        newLocalModel.classes[newId] = { ...cls, id: newId, attributeIds: newAttrIds, operationIds: newOpIds };
        continue;
      }

      const iface = globalModel.interfaces[oldId];
      if (iface) {
        const newOpIds: string[] = [];
        for (const opId of iface.operationIds) {
          const op = globalModel.operations[opId];
          if (op) {
            const newOpId = crypto.randomUUID();
            newLocalModel.operations[newOpId] = { ...op, id: newOpId };
            newOpIds.push(newOpId);
          }
        }
        newLocalModel.interfaces[newId] = { ...iface, id: newId, operationIds: newOpIds };
        continue;
      }

      const enm = globalModel.enums[oldId];
      if (enm) {
        newLocalModel.enums[newId] = { ...enm, id: newId };
      }
    }

    // Clone relations where both endpoints are in this diagram
    const relationIdMap = new Map<string, string>();
    for (const rel of Object.values(globalModel.relations)) {
      const newSrc = elementIdMap.get(rel.sourceId);
      const newTgt = elementIdMap.get(rel.targetId);
      if (!newSrc || !newTgt) continue;
      const newRelId = crypto.randomUUID();
      relationIdMap.set(rel.id, newRelId);
      newLocalModel.relations[newRelId] = { ...rel, id: newRelId, sourceId: newSrc, targetId: newTgt };
    }

    // Carry over the package names that are actually used by elements in this diagram.
    const usedPackageNames = new Set<string>();
    for (const cls of Object.values(newLocalModel.classes)) {
      if (cls.packageName) usedPackageNames.add(cls.packageName);
    }
    for (const iface of Object.values(newLocalModel.interfaces)) {
      if (iface.packageName) usedPackageNames.add(iface.packageName);
    }
    for (const enm of Object.values(newLocalModel.enums)) {
      if (enm.packageName) usedPackageNames.add(enm.packageName);
    }
    newLocalModel.packageNames = Array.from(usedPackageNames);

    // Remap DiagramView to new local IDs
    const diagramView = view as DiagramView;
    const newNodes = diagramView.nodes.map((vn) => ({
      ...vn,
      elementId: elementIdMap.get(vn.elementId) ?? vn.elementId,
    }));
    const newEdges = diagramView.edges
      .filter((ve) => relationIdMap.has(ve.relationId))
      .map((ve) => ({ ...ve, relationId: relationIdMap.get(ve.relationId)! }));

    useVFSStore.getState().updateNode(contextMenu.nodeId, {
      standalone: true,
      localModel: newLocalModel,
      content: { ...diagramView, nodes: newNodes, edges: newEdges },
    } as Partial<VFSFile>);

    useToastStore.getState().show(`"${file.name}" is now standalone — ${elementIds.size} element${elementIds.size !== 1 ? 's' : ''} forked`);
    setContextMenu(null);
  };

  /**
   * Merge lifecycle: returns a standalone .luml file back to the shared project workspace.
   *
   * Injects all localModel elements into the global SemanticModel with conflict
   * resolution (appends _1, _2 suffix for name collisions). Remaps the DiagramView
   * to point at new global IDs. Clears localModel and flips standalone: false.
   */
  const handleAddStandaloneToProject = () => {
    if (!contextMenu || !project) return;
    const file = project.nodes[contextMenu.nodeId] as VFSFile;
    if (!file || file.type !== "FILE") return;

    const localModel = file.localModel;

    if (!localModel) {
      // No localModel — just flip the flag (backward-compat).
      useVFSStore.getState().updateNode(contextMenu.nodeId, { standalone: false } as Partial<VFSFile>);
      useToastStore.getState().show(`"${file.name}" rejoined the project workspace`);
      setContextMenu(null);
      return;
    }

    const ms = useModelStore.getState();
    if (!ms.model) {
      ms.initModel(project.domainModelId);
    }
    const refreshedMs = useModelStore.getState();
    const globalModel = refreshedMs.model!;

    const resolveConflict = (name: string, existingNames: Set<string>): string => {
      if (!existingNames.has(name)) return name;
      let i = 1;
      while (existingNames.has(`${name}_${i}`)) i++;
      return `${name}_${i}`;
    };

    const existingClassNames = new Set(Object.values(globalModel.classes).map((c) => c.name));
    const existingIfaceNames = new Set(Object.values(globalModel.interfaces).map((i) => i.name));
    const existingEnumNames = new Set(Object.values(globalModel.enums).map((e) => e.name));

    // Map: old localModel element ID → new global element ID
    const elementIdMap = new Map<string, string>();

    for (const cls of Object.values(localModel.classes)) {
      const resolvedName = resolveConflict(cls.name, existingClassNames);
      existingClassNames.add(resolvedName);
      const attrs = cls.attributeIds.map((id) => localModel.attributes[id]).filter(Boolean);
      const ops = cls.operationIds.map((id) => localModel.operations[id]).filter(Boolean);
      const newGlobalId = cls.isAbstract
        ? refreshedMs.createAbstractClass({ name: resolvedName, packageName: cls.packageName, attributeIds: [], operationIds: [] })
        : refreshedMs.createClass({ name: resolvedName, packageName: cls.packageName, attributeIds: [], operationIds: [] });
      elementIdMap.set(cls.id, newGlobalId);
      if (attrs.length > 0 || ops.length > 0) {
        refreshedMs.setElementMembers(
          newGlobalId,
          attrs.map((a) => ({ ...a, id: crypto.randomUUID() })),
          ops.map((o) => ({ ...o, id: crypto.randomUUID() })),
        );
      }
    }

    for (const iface of Object.values(localModel.interfaces)) {
      const resolvedName = resolveConflict(iface.name, existingIfaceNames);
      existingIfaceNames.add(resolvedName);
      const ops = iface.operationIds.map((id) => localModel.operations[id]).filter(Boolean);
      const newGlobalId = refreshedMs.createInterface({ name: resolvedName, packageName: iface.packageName, operationIds: [] });
      elementIdMap.set(iface.id, newGlobalId);
      if (ops.length > 0) {
        refreshedMs.setElementMembers(newGlobalId, [], ops.map((o) => ({ ...o, id: crypto.randomUUID() })));
      }
    }

    for (const enm of Object.values(localModel.enums)) {
      const resolvedName = resolveConflict(enm.name, existingEnumNames);
      existingEnumNames.add(resolvedName);
      const newGlobalId = refreshedMs.createEnum({ name: resolvedName, packageName: enm.packageName, literals: enm.literals });
      elementIdMap.set(enm.id, newGlobalId);
    }

    // Inject package names from localModel into the global model (dedup via addPackageName).
    for (const pkgName of (localModel.packageNames ?? [])) {
      if (pkgName) refreshedMs.addPackageName(pkgName);
    }

    // Inject relations (only those where both endpoints were successfully mapped)
    const relationIdMap = new Map<string, string>();
    for (const rel of Object.values(localModel.relations)) {
      const newSrc = elementIdMap.get(rel.sourceId);
      const newTgt = elementIdMap.get(rel.targetId);
      if (!newSrc || !newTgt) continue;
      const { id: _id, ...relData } = rel;
      const newRelId = refreshedMs.createRelation({ ...relData, sourceId: newSrc, targetId: newTgt });
      relationIdMap.set(rel.id, newRelId);
    }

    // Remap DiagramView
    const view = file.content as DiagramView | null;
    let newContent: DiagramView | null = view;
    if (view && 'nodes' in view) {
      const diagramView = view as DiagramView;
      const newNodes = diagramView.nodes.map((vn) => ({
        ...vn,
        elementId: elementIdMap.get(vn.elementId) ?? vn.elementId,
      }));
      const newEdges = diagramView.edges.map((ve) => ({
        ...ve,
        relationId: relationIdMap.get(ve.relationId) ?? ve.relationId,
      }));
      newContent = { ...diagramView, nodes: newNodes, edges: newEdges };
    }

    useVFSStore.getState().updateNode(contextMenu.nodeId, {
      standalone: false,
      localModel: null,
      content: newContent,
    } as Partial<VFSFile>);

    const merged = elementIdMap.size;
    useToastStore.getState().show(`"${file.name}" merged — ${merged} element${merged !== 1 ? 's' : ''} added to project`);
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
        <div
          className="px-4 py-3 border-b border-surface-border shrink-0 flex items-center justify-between select-none cursor-default group"
          onDoubleClick={toggleLeftPanel}
        >
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-text-muted" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Project Files
            </h3>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); toggleLeftPanel(); }}
            className="p-1 hover:bg-surface-hover rounded transition-colors"
            title="Close Panel"
          >
            <PanelLeftClose className="w-3.5 h-3.5 text-text-muted" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="text-center">
            <FolderTree className="w-12 h-12 text-text-muted/30 mx-auto mb-3" />
            <p className="text-sm text-text-muted">{t('projectStructure.noProjectActive')}</p>
          </div>
        </div>
      </div>
    );
  }

  const allRootNodes = Object.values(project.nodes).filter(
    (n) =>
      n.parentId === null &&
      !(n.type === "FILE" && (n as VFSFile).extension === ".model"),
  );

  const projectNodes = allRootNodes
    .filter((n) => !(n.type === "FILE" && ((n as VFSFile).isExternal === true || (n as VFSFile).standalone === true)))
    .sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "FOLDER" ? -1 : 1;
    });

  const standaloneNodes = Object.values(project.nodes)
    .filter((n) => n.type === "FILE" && ((n as VFSFile).standalone === true || (n as VFSFile).isExternal === true))
    .sort((a, b) => a.name.localeCompare(b.name)) as VFSFile[];

  return (
    <div className="flex flex-col h-full bg-surface-primary overflow-hidden">

      {/* ── File Tree ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header */}
        <div
          className="px-4 py-3 border-b border-surface-border flex items-center justify-between shrink-0 select-none cursor-default group"
          onDoubleClick={toggleLeftPanel}
        >
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-text-muted" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Project Files
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleNewFileAtRoot(); }}
              className="p-1 hover:bg-surface-hover rounded transition-colors"
              title="New File"
            >
              <PlusSquare className="w-3.5 h-3.5 text-text-muted hover:text-text-primary" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNewFolderAtRoot(); }}
              className="p-1 hover:bg-surface-hover rounded transition-colors"
              title="New Folder"
            >
              <FolderPlus className="w-3.5 h-3.5 text-text-muted hover:text-text-primary" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleLeftPanel(); }}
              className="p-1 hover:bg-surface-hover rounded transition-colors"
              title="Close Panel"
            >
              <PanelLeftClose className="w-3.5 h-3.5 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Tree body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
          {projectNodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FolderTree className="w-12 h-12 text-text-muted/30 mx-auto mb-3" />
                <p className="text-sm text-text-muted">{t('projectStructure.emptyProject')}</p>
                <p className="text-xs text-text-muted/70 mt-1">
                  {t('projectStructure.addFilesAndFolders')}
                </p>
              </div>
            </div>
          ) : (
            projectNodes.map((node) => (
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

      {/* ── Standalone Files ──────────────────────────────────────────────── */}
      {standaloneNodes.length > 0 && (
        <div className="flex flex-col shrink-0 border-t border-surface-border">
          <button
            className="flex items-center justify-between px-4 py-2 w-full hover:bg-surface-hover transition-colors group"
            onClick={() => setIsStandaloneExpanded((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-amber-500/70" />
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted group-hover:text-text-primary transition-colors">
                Standalone Files
              </span>
              <span className="text-[10px] font-mono text-text-muted/40 tabular-nums">
                {standaloneNodes.length}
              </span>
            </div>
            {isStandaloneExpanded ? (
              <ChevronDown className="w-3 h-3 text-text-muted" />
            ) : (
              <ChevronRight className="w-3 h-3 text-text-muted" />
            )}
          </button>

          {isStandaloneExpanded && (
            <div className="pb-1">
              {standaloneNodes.map((file) => {
                const isEditing = editingNodeId === file.id;
                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-hover transition-colors cursor-pointer group"
                    style={{ paddingLeft: "28px" }}
                    onContextMenu={(e) => handleContextMenu(e, file)}
                    onDoubleClick={() => handleOpenFile(file.id)}
                  >
                    <LayoutTemplate className={`w-3.5 h-3.5 shrink-0 ${file.standalone ? "text-amber-400" : "text-purple-400"}`} />
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                          else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                        }}
                        onBlur={commitEdit}
                        className="flex-1 bg-surface-secondary border border-blue-500 rounded px-1 py-0.5 text-xs text-text-primary focus:outline-none"
                      />
                    ) : (
                      <>
                        <span className="text-xs text-text-secondary group-hover:text-text-primary truncate flex-1">
                          {file.name}
                        </span>
                        {file.standalone ? (
                          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-amber-500/80 bg-amber-500/10 border border-amber-500/20 rounded px-1 py-px leading-none">
                            solo
                          </span>
                        ) : (
                          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-sky-500/80 bg-sky-500/10 border border-sky-500/20 rounded px-1 py-px leading-none">
                            ext
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
      )}

      {/* ── Context menu ─────────────────────────────────────────────────── */}
      {contextMenu && (
        <div
          className="fixed bg-surface-secondary border border-surface-border rounded-md shadow-lg py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: Math.min(contextMenu.y, window.innerHeight - 260) }}
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

              {/* External file (from XMI/legacy import) → integrate elements into project */}
              {contextMenu.isExternal && (
                <button
                  onClick={handleAddFileToProject}
                  className="w-full px-3 py-1.5 text-left text-xs text-emerald-400 hover:bg-surface-hover flex items-center gap-2"
                >
                  <FolderPlus className="w-3 h-3" />
                  Add File to Project
                </button>
              )}

              {/* Standalone diagram file → rejoin shared workspace (flag only, model untouched) */}
              {contextMenu.isLuml && !contextMenu.isExternal && contextMenu.isStandalone && (
                <button
                  onClick={handleAddStandaloneToProject}
                  className="w-full px-3 py-1.5 text-left text-xs text-emerald-400 hover:bg-surface-hover flex items-center gap-2"
                >
                  <FolderPlus className="w-3 h-3" />
                  Add to Project
                </button>
              )}

              {/* Normal project diagram → isolate canvas view (flag only, model untouched) */}
              {contextMenu.isLuml && !contextMenu.isExternal && !contextMenu.isStandalone && (
                <button
                  onClick={handleMakeStandalone}
                  className="w-full px-3 py-1.5 text-left text-xs text-amber-400 hover:bg-surface-hover flex items-center gap-2"
                >
                  <Unlink className="w-3 h-3" />
                  Make Standalone
                </button>
              )}

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
