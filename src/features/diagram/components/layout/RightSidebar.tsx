import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Network,
  PanelRightClose,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Plus,
  EyeOff,
  Folder,
  FolderOpen,
  FolderPlus,
  ArrowRightLeft,
} from "lucide-react";
import { useLayoutStore } from "../../../../store/layout.store";
import { useModelStore } from "../../../../store/model.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useUiStore } from "../../../../store/uiStore";
import { useToastStore } from "../../../../store/toast.store";
import { standaloneModelOps } from "../../../../store/standaloneModelOps";
import { DRAG_TYPE_EXISTING, getNextVFSName } from "../../../../canvas/hooks/useKonvaDnD";
import type {
  VFSFile,
  SemanticModel,
  IRClass,
  IRInterface,
  IREnum,
  IRAttribute,
  IROperation,
} from "../../../../core/domain/vfs/vfs.types";

interface CtxMenuState {
  id: string;
  x: number;
  y: number;
}

interface PkgPickerState {
  id: string;
  x: number;
  y: number;
  isStandalone?: boolean;
}
function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded shrink-0 ${className}`}
    >
      {label}
    </span>
  );
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

function MemberRow({
  label,
  badgeClass,
  text,
}: {
  label: string;
  badgeClass: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-1.5 py-0.5 pl-10 pr-2">
      <Badge label={label} className={badgeClass} />
      <span className="text-[11px] text-text-muted truncate font-mono">{text}</span>
    </div>
  );
}

// ─── ElementRow ───────────────────────────────────────────────────────────────

interface ElementRowProps {
  id: string;
  name: string;
  badge: string;
  badgeClass: string;
  attributes?: IRAttribute[];
  operations?: IROperation[];
  onShowContextMenu: (id: string, x: number, y: number) => void;
}

function ElementRow({
  id,
  name,
  badge,
  badgeClass,
  attributes = [],
  operations = [],
  onShowContextMenu,
}: ElementRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMembers = attributes.length > 0 || operations.length > 0;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE_EXISTING, id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onShowContextMenu(id, e.clientX, e.clientY);
  };

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDoubleClick={(e) => { e.stopPropagation(); if (hasMembers) setExpanded((v) => !v); }}
        onContextMenu={handleContextMenu}
        className="flex items-center gap-1 px-2 py-0.5 hover:bg-surface-hover cursor-grab active:cursor-grabbing select-none"
        title="Drag to canvas · Double-click to expand · Right-click for more"
      >
        <button
          draggable={false}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
          className="shrink-0 p-0.5 rounded hover:bg-white/5"
          onClick={(e) => { e.stopPropagation(); if (hasMembers) setExpanded((v) => !v); }}
        >
          {hasMembers ? (
            expanded ? (
              <ChevronDown className="w-3 h-3 text-text-muted" />
            ) : (
              <ChevronRight className="w-3 h-3 text-text-muted" />
            )
          ) : (
            <span className="w-3 h-3 block" />
          )}
        </button>
        <Badge label={badge} className={badgeClass} />
        <span className="text-xs text-text-primary flex-1 truncate ml-1">{name}</span>
      </div>

      {expanded && hasMembers && (
        <div>
          {attributes.map((attr) => (
            <MemberRow
              key={attr.id}
              label="f"
              badgeClass="bg-slate-500/20 text-slate-400"
              text={`${attr.name}: ${attr.type}`}
            />
          ))}
          {operations.map((op) => (
            <MemberRow
              key={op.id}
              label="m"
              badgeClass="bg-teal-500/20 text-teal-400"
              text={`${op.name}(): ${op.returnType ?? "void"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PackageFolder ────────────────────────────────────────────────────────────

interface PackageFolderProps {
  name: string;
  count: number;
  isDefault?: boolean;
  onCreate?: () => void;
  children: React.ReactNode;
}

function PackageFolder({ name, count, isDefault = false, onCreate, children }: PackageFolderProps) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <div className="flex items-center">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2 py-1 hover:bg-surface-hover select-none flex-1 min-w-0"
        >
          {open ? (
            <FolderOpen className="w-3.5 h-3.5 text-blue-400/60 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-blue-400/60 shrink-0" />
          )}
          <span
            className={`text-[11px] font-semibold flex-1 text-left truncate ${
              isDefault ? "text-text-muted/40 italic" : "text-text-muted"
            }`}
          >
            {name}
          </span>
          <span className="text-[10px] text-text-muted/40 font-mono tabular-nums mr-1">
            {count}
          </span>
        </button>

        {onCreate && (
          <button
            onClick={(e) => { e.stopPropagation(); onCreate(); }}
            className="px-1.5 py-1 hover:bg-surface-hover rounded transition-colors mr-1"
            title="New Class"
          >
            <Plus className="w-3 h-3 text-text-muted hover:text-text-primary" />
          </button>
        )}
      </div>

      {open && (
        <div className="ml-3 pl-1 border-l border-surface-border/30">
          {children}
          {count === 0 && (
            <p className="text-[10px] text-text-muted/30 italic px-4 py-0.5">— none —</p>
          )}
        </div>
      )}
    </div>
  );
}

type ElementKind = "class" | "abstract" | "interface" | "enum";

export default function RightSidebar() {
  const { toggleRightPanel } = useLayoutStore();
  const model = useModelStore((s) => s.model);
  const initModel = useModelStore((s) => s.initModel);
  const createClass = useModelStore((s) => s.createClass);
  const createInterface = useModelStore((s) => s.createInterface);
  const createEnum = useModelStore((s) => s.createEnum);
  const addPackageName = useModelStore((s) => s.addPackageName);
  const setElementPackage = useModelStore((s) => s.setElementPackage);
  const project = useVFSStore((s) => s.project);
  const openSSoTClassEditor = useUiStore((s) => s.openSSoTClassEditor);
  const openGlobalDelete = useUiStore((s) => s.openGlobalDelete);

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const activeVFSFile = activeTabId
    ? (project?.nodes[activeTabId] as VFSFile | undefined)
    : undefined;
  const isStandalone = activeVFSFile?.type === "FILE" && activeVFSFile.standalone === true;

  // Reactive subscription to the active file's localModel (standalone only).
  const localModel = useVFSStore((s): SemanticModel | null => {
    if (!activeTabId || !s.project) return null;
    const node = s.project.nodes[activeTabId];
    if (!node || node.type !== "FILE") return null;
    return (node as VFSFile).localModel ?? null;
  });

  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [pkgPicker, setPkgPicker] = useState<PkgPickerState | null>(null);
  const [standaloneCtxMenu, setStandaloneCtxMenu] = useState<CtxMenuState | null>(null);

  const dismissCtxMenu = useCallback(() => setCtxMenu(null), []);
  const dismissPkgPicker = useCallback(() => setPkgPicker(null), []);
  const dismissStandaloneCtxMenu = useCallback(() => setStandaloneCtxMenu(null), []);

  useEffect(() => {
    if (!ctxMenu && !pkgPicker && !standaloneCtxMenu) return;
    const handler = () => { dismissCtxMenu(); dismissPkgPicker(); dismissStandaloneCtxMenu(); };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [ctxMenu, pkgPicker, standaloneCtxMenu, dismissCtxMenu, dismissPkgPicker, dismissStandaloneCtxMenu]);

  const handleShowContextMenu = useCallback(
    (id: string, x: number, y: number) => setCtxMenu({ id, x, y }),
    [],
  );

  const handleShowStandaloneContextMenu = useCallback(
    (id: string, x: number, y: number) => setStandaloneCtxMenu({ id, x, y }),
    [],
  );

  // ── Helpers ────────────────────────────────────────────────────────────────

  const ensureModel = useCallback(() => {
    if (!useModelStore.getState().model) {
      initModel(project?.domainModelId ?? crypto.randomUUID());
    }
  }, [initModel, project]);

  const resolveAttrs = (ids: string[]): IRAttribute[] =>
    model ? ids.map((id) => model.attributes[id]).filter(Boolean) : [];

  const resolveOps = (ids: string[]): IROperation[] =>
    model ? ids.map((id) => model.operations[id]).filter(Boolean) : [];

  // ── Package groups ─────────────────────────────────────────────────────────

  const packageNames: string[] = useMemo(() => model?.packageNames ?? [], [model]);

  const DEFAULT_PKG = "__default__";

  interface PkgGroup {
    classes: IRClass[];
    abstractClasses: IRClass[];
    interfaces: IRInterface[];
    enums: IREnum[];
  }

  const packageGroups = useMemo((): Map<string, PkgGroup> => {
    const empty = (): PkgGroup => ({ classes: [], abstractClasses: [], interfaces: [], enums: [] });
    const groups = new Map<string, PkgGroup>();

    groups.set(DEFAULT_PKG, empty());
    packageNames.forEach((n) => groups.set(n, empty()));

    if (!model) return groups;

    Object.values(model.classes)
      .filter((c) => !c.isExternal)
      .forEach((cls) => {
        const key = cls.packageName?.trim() || DEFAULT_PKG;
        if (!groups.has(key)) groups.set(key, empty());
        const g = groups.get(key)!;
        if (cls.isAbstract) g.abstractClasses.push(cls);
        else g.classes.push(cls);
      });

    Object.values(model.interfaces)
      .filter((i) => !i.isExternal)
      .forEach((iface) => {
        const key = iface.packageName?.trim() || DEFAULT_PKG;
        if (!groups.has(key)) groups.set(key, empty());
        groups.get(key)!.interfaces.push(iface);
      });

    Object.values(model.enums)
      .filter((e) => !e.isExternal)
      .forEach((enm) => {
        const key = enm.packageName?.trim() || DEFAULT_PKG;
        if (!groups.has(key)) groups.set(key, empty());
        groups.get(key)!.enums.push(enm);
      });

    return groups;
  }, [model, packageNames]);

  const groupCount = (g: PkgGroup) =>
    g.classes.length + g.abstractClasses.length + g.interfaces.length + g.enums.length;

  // ── Element creation ───────────────────────────────────────────────────────

  const handleCreate = useCallback(
    (kind: ElementKind, targetPkg?: string) => {
      ensureModel();
      const m = useModelStore.getState().model!;
      let id: string;
      const pkgProp = targetPkg ? { packageName: targetPkg } : {};

      if (kind === "class") {
        const name = getNextVFSName(
          Object.values(m.classes).filter((c) => !c.isAbstract).map((c) => c.name),
          "Class",
        );
        id = createClass({ name, attributeIds: [], operationIds: [], ...pkgProp });
      } else if (kind === "abstract") {
        const name = getNextVFSName(
          Object.values(m.classes).filter((c) => !!c.isAbstract).map((c) => c.name),
          "Abstract",
        );
        id = createClass({ name, isAbstract: true, attributeIds: [], operationIds: [], ...pkgProp });
      } else if (kind === "interface") {
        const name = getNextVFSName(
          Object.values(m.interfaces).map((i) => i.name),
          "Interface",
        );
        id = createInterface({ name, operationIds: [], ...pkgProp });
      } else {
        const name = getNextVFSName(
          Object.values(m.enums).map((e) => e.name),
          "Enum",
        );
        id = createEnum({ name, literals: [], ...pkgProp });
      }

      openSSoTClassEditor(id);
    },
    [ensureModel, createClass, createInterface, createEnum, openSSoTClassEditor],
  );

  // ── New package ────────────────────────────────────────────────────────────

  const handleNewPackage = useCallback(() => {
    const raw = window.prompt("Package name (e.g. com.example.models):");
    if (!raw?.trim()) return;
    const name = raw.trim();
    if ((model?.packageNames ?? []).includes(name)) {
      useToastStore.getState().show(`Package "${name}" already exists`);
      return;
    }
    ensureModel();
    addPackageName(name);
    useToastStore.getState().show(`Package "${name}" created`);
  }, [model, ensureModel, addPackageName]);

  const handleStandaloneNewPackage = useCallback(() => {
    if (!activeTabId) return;
    const raw = window.prompt("Package name (e.g. com.example.models):");
    if (!raw?.trim()) return;
    const name = raw.trim();
    if ((localModel?.packageNames ?? []).includes(name)) {
      useToastStore.getState().show(`Package "${name}" already exists`);
      return;
    }
    standaloneModelOps(activeTabId).addPackageName(name);
    useToastStore.getState().show(`Package "${name}" created`);
  }, [activeTabId, localModel]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderGroup = (key: string, group: PkgGroup) => {
    const total = groupCount(group);
    const isDefault = key === DEFAULT_PKG;
    const label = isDefault ? "default" : key;
    const targetPkg = isDefault ? undefined : key;

    return (
      <PackageFolder
        key={key}
        name={label}
        count={total}
        isDefault={isDefault}
        onCreate={() => handleCreate("class", targetPkg)}
      >
        {group.classes.map((cls) => (
          <ElementRow
            key={cls.id}
            id={cls.id}
            name={cls.name}
            badge="C"
            badgeClass="bg-blue-500/20 text-blue-400"
            attributes={resolveAttrs(cls.attributeIds)}
            operations={resolveOps(cls.operationIds)}
            onShowContextMenu={handleShowContextMenu}
          />
        ))}
        {group.abstractClasses.map((cls) => (
          <ElementRow
            key={cls.id}
            id={cls.id}
            name={cls.name}
            badge="A"
            badgeClass="bg-purple-500/20 text-purple-400"
            attributes={resolveAttrs(cls.attributeIds)}
            operations={resolveOps(cls.operationIds)}
            onShowContextMenu={handleShowContextMenu}
          />
        ))}
        {group.interfaces.map((iface) => (
          <ElementRow
            key={iface.id}
            id={iface.id}
            name={iface.name}
            badge="I"
            badgeClass="bg-emerald-500/20 text-emerald-400"
            operations={resolveOps(iface.operationIds)}
            onShowContextMenu={handleShowContextMenu}
          />
        ))}
        {group.enums.map((en) => (
          <ElementRow
            key={en.id}
            id={en.id}
            name={en.name}
            badge="E"
            badgeClass="bg-amber-500/20 text-amber-400"
            onShowContextMenu={handleShowContextMenu}
          />
        ))}
      </PackageFolder>
    );
  };

  return (
    <div className="w-64 h-full border-l border-surface-border bg-surface-primary flex flex-col">
      <div
        className="px-4 py-3 border-b border-surface-border shrink-0 flex items-center justify-between select-none cursor-default group"
        onDoubleClick={toggleRightPanel}
      >
        <div className="flex items-center gap-2">
          <Network className={`w-4 h-4 ${isStandalone ? "text-text-muted/30" : "text-text-muted"}`} />
          <h3 className={`text-xs font-semibold uppercase tracking-wider ${isStandalone ? "text-text-muted/30" : "text-text-muted"}`}>
            Model Explorer
          </h3>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); isStandalone ? handleStandaloneNewPackage() : handleNewPackage(); }}
            className="p-1 hover:bg-surface-hover rounded transition-colors opacity-0 group-hover:opacity-100"
            title="New Package"
          >
            <FolderPlus className={`w-3.5 h-3.5 ${isStandalone ? "text-amber-400/60" : "text-text-muted"}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleRightPanel(); }}
            className="p-1 hover:bg-surface-hover rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Close Panel"
          >
            <PanelRightClose className="w-3.5 h-3.5 text-text-muted" />
          </button>
        </div>
      </div>
      {isStandalone ? (
        <div className="flex-1 overflow-y-auto py-1">
          {!localModel || (
            Object.keys(localModel.classes).length === 0 &&
            Object.keys(localModel.interfaces).length === 0 &&
            Object.keys(localModel.enums).length === 0
          ) ? (
            <div className="flex flex-col items-center justify-center h-full p-5 gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#1e2738] border border-[#2a3358]">
                <Network className="w-5 h-5 text-amber-400/40" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-amber-400/60 mb-1">
                  Standalone File
                </p>
                <p className="text-[11px] text-text-muted/30 leading-relaxed">
                  Drop elements onto the canvas to populate this diagram.
                </p>
              </div>
            </div>
          ) : (() => {
            const lm = localModel!;
            const DEFAULT_SPKG = "__default__";
            const spkgNames: string[] = lm.packageNames ?? [];
            interface SpkgGroup { classes: typeof lm.classes[string][]; interfaces: typeof lm.interfaces[string][]; enums: typeof lm.enums[string][]; }
            const emptySpkg = (): SpkgGroup => ({ classes: [], interfaces: [], enums: [] });
            const spkgGroups = new Map<string, SpkgGroup>();
            spkgGroups.set(DEFAULT_SPKG, emptySpkg());
            spkgNames.forEach((n) => spkgGroups.set(n, emptySpkg()));
            Object.values(lm.classes).forEach((cls) => {
              const key = cls.packageName?.trim() || DEFAULT_SPKG;
              if (!spkgGroups.has(key)) spkgGroups.set(key, emptySpkg());
              spkgGroups.get(key)!.classes.push(cls);
            });
            Object.values(lm.interfaces).forEach((iface) => {
              const key = iface.packageName?.trim() || DEFAULT_SPKG;
              if (!spkgGroups.has(key)) spkgGroups.set(key, emptySpkg());
              spkgGroups.get(key)!.interfaces.push(iface);
            });
            Object.values(lm.enums).forEach((enm) => {
              const key = enm.packageName?.trim() || DEFAULT_SPKG;
              if (!spkgGroups.has(key)) spkgGroups.set(key, emptySpkg());
              spkgGroups.get(key)!.enums.push(enm);
            });

            return Array.from(spkgGroups.entries()).map(([key, group]) => {
              const total = group.classes.length + group.interfaces.length + group.enums.length;
              if (total === 0 && key !== DEFAULT_SPKG) return null;
              return (
                <PackageFolder
                  key={key}
                  name={key === DEFAULT_SPKG ? "default" : key}
                  count={total}
                  isDefault={key === DEFAULT_SPKG}
                >
                  {group.classes.map((cls) => (
                    <ElementRow
                      key={cls.id}
                      id={cls.id}
                      name={cls.name}
                      badge={cls.isAbstract ? "A" : "C"}
                      badgeClass={cls.isAbstract ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"}
                      attributes={cls.attributeIds.map((id) => lm.attributes[id]).filter(Boolean)}
                      operations={cls.operationIds.map((id) => lm.operations[id]).filter(Boolean)}
                      onShowContextMenu={handleShowStandaloneContextMenu}
                    />
                  ))}
                  {group.interfaces.map((iface) => (
                    <ElementRow
                      key={iface.id}
                      id={iface.id}
                      name={iface.name}
                      badge="I"
                      badgeClass="bg-emerald-500/20 text-emerald-400"
                      operations={iface.operationIds.map((id) => lm.operations[id]).filter(Boolean)}
                      onShowContextMenu={handleShowStandaloneContextMenu}
                    />
                  ))}
                  {group.enums.map((enm) => (
                    <ElementRow
                      key={enm.id}
                      id={enm.id}
                      name={enm.name}
                      badge="E"
                      badgeClass="bg-amber-500/20 text-amber-400"
                      onShowContextMenu={handleShowStandaloneContextMenu}
                    />
                  ))}
                </PackageFolder>
              );
            });
          })()}
        </div>
      ) : !model && !project ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-text-muted/40 text-center leading-relaxed">
            Open a .luml diagram and drop elements to populate the model.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
          {Array.from(packageGroups.entries()).map(([key, group]) =>
            renderGroup(key, group),
          )}
        </div>
      )}

      {ctxMenu && (
        <div
          className="fixed z-[9000] bg-[#1a2235] border border-[#2d3f5c] rounded-lg shadow-2xl py-1 min-w-[180px]"
          style={{ top: Math.min(ctxMenu.y, window.innerHeight - 200), left: ctxMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 transition-colors"
            onClick={() => { openSSoTClassEditor(ctxMenu.id); dismissCtxMenu(); }}
          >
            <Pencil className="w-3.5 h-3.5 text-slate-400" />
            Edit...
          </button>

          <button
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 transition-colors"
            onClick={() => {
              setPkgPicker({ id: ctxMenu.id, x: ctxMenu.x + 182, y: ctxMenu.y });
              dismissCtxMenu();
            }}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
            Move to Package...
          </button>

          <button
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-950/30 transition-colors"
            onClick={() => {
              const m = useModelStore.getState().model;
              if (!m) { dismissCtxMenu(); return; }
              const elementName =
                m.classes[ctxMenu.id]?.name ??
                m.interfaces[ctxMenu.id]?.name ??
                m.enums[ctxMenu.id]?.name ??
                'Element';
              useModelStore.getState().untrackElement(ctxMenu.id);
              useToastStore.getState().show(`"${elementName}" untracked from project`);
              dismissCtxMenu();
            }}
          >
            <EyeOff className="w-3.5 h-3.5" />
            Untrack from Project
          </button>

          <div className="border-t border-[#2d3f5c] my-1" />

          <button
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/40 transition-colors"
            onClick={() => { openGlobalDelete(ctxMenu.id); dismissCtxMenu(); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete from Project
          </button>
        </div>
      )}

      {standaloneCtxMenu && activeTabId && (
        <div
          className="fixed z-[9000] bg-[#1a2235] border border-[#2d3f5c] rounded-lg shadow-2xl py-1 min-w-[180px]"
          style={{ top: Math.min(standaloneCtxMenu.y, window.innerHeight - 160), left: standaloneCtxMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 transition-colors"
            onClick={() => { openSSoTClassEditor(standaloneCtxMenu.id); dismissStandaloneCtxMenu(); }}
          >
            <Pencil className="w-3.5 h-3.5 text-slate-400" />
            Edit...
          </button>

          <button
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 transition-colors"
            onClick={() => {
              setPkgPicker({ id: standaloneCtxMenu.id, x: standaloneCtxMenu.x + 182, y: standaloneCtxMenu.y, isStandalone: true });
              dismissStandaloneCtxMenu();
            }}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
            Move to Package...
          </button>

          <div className="border-t border-[#2d3f5c] my-1" />

          <button
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/40 transition-colors"
            onClick={() => {
              const lm = localModel;
              if (!lm) { dismissStandaloneCtxMenu(); return; }
              const id = standaloneCtxMenu.id;
              const elementName =
                lm.classes[id]?.name ??
                lm.interfaces[id]?.name ??
                lm.enums[id]?.name ??
                'Element';
              const ops = standaloneModelOps(activeTabId);
              if (lm.classes[id])         ops.deleteClass(id);
              else if (lm.interfaces[id]) ops.deleteInterface(id);
              else if (lm.enums[id])      ops.deleteEnum(id);
              useToastStore.getState().show(`"${elementName}" deleted from standalone diagram`);
              dismissStandaloneCtxMenu();
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete from Diagram
          </button>
        </div>
      )}

      {pkgPicker && (
        <div
          className="fixed z-[9001] bg-[#1a2235] border border-[#2d3f5c] rounded-lg shadow-2xl py-1 min-w-[200px]"
          style={{
            top: Math.min(pkgPicker.y, window.innerHeight - 200),
            left: Math.min(pkgPicker.x, window.innerWidth - 210),
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-3 pt-1 pb-0.5">
            Move to package
          </p>
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 transition-colors italic"
            onClick={() => {
              if (pkgPicker.isStandalone && activeTabId) {
                standaloneModelOps(activeTabId).setElementPackage(pkgPicker.id, undefined);
              } else {
                setElementPackage(pkgPicker.id, undefined);
              }
              dismissPkgPicker();
            }}
          >
            <Folder className="w-3.5 h-3.5 text-slate-500" />
            (default)
          </button>
          {(pkgPicker.isStandalone ? (localModel?.packageNames ?? []) : (model?.packageNames ?? [])).map((pkgName) => (
            <button
              key={pkgName}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 transition-colors"
              onClick={() => {
                if (pkgPicker.isStandalone && activeTabId) {
                  standaloneModelOps(activeTabId).setElementPackage(pkgPicker.id, pkgName);
                } else {
                  setElementPackage(pkgPicker.id, pkgName);
                }
                dismissPkgPicker();
              }}
            >
              <Folder className="w-3.5 h-3.5 text-blue-400/60" />
              {pkgName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
