import { useState, useEffect, useCallback } from "react";
import {
  Network,
  PanelRightClose,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Plus,
  EyeOff,
} from "lucide-react";
import { useLayoutStore } from "../../../../store/layout.store";
import { useModelStore } from "../../../../store/model.store";
import { useVFSStore } from "../../../../store/vfs.store";
import { useUiStore } from "../../../../store/uiStore";
import { useToastStore } from "../../../../store/toast.store";
import { DRAG_TYPE_EXISTING, getNextVFSName } from "../../hooks/useDiagramDnD";
import type {
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

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded shrink-0 ${className}`}
    >
      {label}
    </span>
  );
}

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
          onClick={(e) => {
            e.stopPropagation();
            if (hasMembers) setExpanded((v) => !v);
          }}
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

interface SectionProps {
  title: string;
  count: number;
  children?: React.ReactNode;
  onCreate?: () => void;
  createTitle?: string;
}

function Section({ title, count, children, onCreate, createTitle }: SectionProps) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <div className="flex items-center">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 hover:bg-surface-hover select-none flex-1 min-w-0"
        >
          {open ? (
            <ChevronDown className="w-3 h-3 text-text-muted/60 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-text-muted/60 shrink-0" />
          )}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex-1 text-left truncate">
            {title}
          </span>
          <span className="text-[10px] text-text-muted/40 font-mono tabular-nums mr-1">
            {count}
          </span>
        </button>

        {onCreate && (
          <button
            onClick={(e) => { e.stopPropagation(); onCreate(); }}
            className="px-1.5 py-1 hover:bg-surface-hover rounded transition-colors mr-1"
            title={createTitle ?? `New ${title.replace(/s$/, "")}`}
          >
            <Plus className="w-3 h-3 text-text-muted hover:text-text-primary" />
          </button>
        )}
      </div>

      {open && (
        <div>
          {children}
          {count === 0 && (
            <p className="text-[10px] text-text-muted/30 italic px-8 py-0.5">
              — none —
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function RightSidebar() {
  const { toggleRightPanel } = useLayoutStore();
  const model = useModelStore((s) => s.model);
  const initModel = useModelStore((s) => s.initModel);
  const createClass = useModelStore((s) => s.createClass);
  const createInterface = useModelStore((s) => s.createInterface);
  const createEnum = useModelStore((s) => s.createEnum);
  const project = useVFSStore((s) => s.project);
  const openSSoTClassEditor = useUiStore((s) => s.openSSoTClassEditor);
  const openGlobalDelete = useUiStore((s) => s.openGlobalDelete);

  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);

  const dismissCtxMenu = useCallback(() => setCtxMenu(null), []);

  useEffect(() => {
    if (!ctxMenu) return;
    window.addEventListener("mousedown", dismissCtxMenu);
    return () => window.removeEventListener("mousedown", dismissCtxMenu);
  }, [ctxMenu, dismissCtxMenu]);

  const handleShowContextMenu = useCallback(
    (id: string, x: number, y: number) => setCtxMenu({ id, x, y }),
    [],
  );

  const ensureModel = useCallback(() => {
    if (!useModelStore.getState().model) {
      initModel(project?.domainModelId ?? crypto.randomUUID());
    }
  }, [initModel, project]);

  const handleCreate = useCallback(
    (kind: "class" | "abstract" | "interface" | "enum") => {
      ensureModel();
      const m = useModelStore.getState().model!;
      let id: string;

      if (kind === "class") {
        const name = getNextVFSName(
          Object.values(m.classes).filter((c) => !c.isAbstract).map((c) => c.name),
          "Class",
        );
        id = createClass({ name, attributeIds: [], operationIds: [] });
      } else if (kind === "abstract") {
        const name = getNextVFSName(
          Object.values(m.classes).filter((c) => !!c.isAbstract).map((c) => c.name),
          "Abstract",
        );
        id = createClass({ name, isAbstract: true, attributeIds: [], operationIds: [] });
      } else if (kind === "interface") {
        const name = getNextVFSName(
          Object.values(m.interfaces).map((i) => i.name),
          "Interface",
        );
        id = createInterface({ name, operationIds: [] });
      } else {
        const name = getNextVFSName(
          Object.values(m.enums).map((e) => e.name),
          "Enum",
        );
        id = createEnum({ name, literals: [] });
      }

      openSSoTClassEditor(id);
    },
    [ensureModel, createClass, createInterface, createEnum, openSSoTClassEditor],
  );

  const resolveAttrs = (ids: string[]): IRAttribute[] =>
    model ? ids.map((id) => model.attributes[id]).filter(Boolean) : [];

  const resolveOps = (ids: string[]): IROperation[] =>
    model ? ids.map((id) => model.operations[id]).filter(Boolean) : [];

  const classes: IRClass[] = model
    ? Object.values(model.classes).filter((c) => !c.isAbstract && !c.isExternal)
    : [];
  const abstractClasses: IRClass[] = model
    ? Object.values(model.classes).filter((c) => !!c.isAbstract && !c.isExternal)
    : [];
  const interfaces: IRInterface[] = model
    ? Object.values(model.interfaces).filter((i) => !i.isExternal)
    : [];
  const enums: IREnum[] = model
    ? Object.values(model.enums).filter((e) => !e.isExternal)
    : [];

  return (
    <div className="w-64 h-full border-l border-surface-border bg-surface-primary flex flex-col">
      <div
        className="px-4 py-3 border-b border-surface-border shrink-0 flex items-center justify-between select-none cursor-default group"
        onDoubleClick={toggleRightPanel}
      >
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-text-muted" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Model Explorer
          </h3>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleRightPanel(); }}
          className="p-1 hover:bg-surface-hover rounded transition-colors opacity-0 group-hover:opacity-100"
          title="Close Panel"
        >
          <PanelRightClose className="w-3.5 h-3.5 text-text-muted" />
        </button>
      </div>

      {!model && !project ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-text-muted/40 text-center leading-relaxed">
            Open a .luml diagram and drop elements to populate the model.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
          <Section
            title="Classes"
            count={classes.length}
            onCreate={() => handleCreate("class")}
            createTitle="New Class"
          >
            {classes.map((cls) => (
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
          </Section>

          <Section
            title="Abstract Classes"
            count={abstractClasses.length}
            onCreate={() => handleCreate("abstract")}
            createTitle="New Abstract Class"
          >
            {abstractClasses.map((cls) => (
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
          </Section>

          <Section
            title="Interfaces"
            count={interfaces.length}
            onCreate={() => handleCreate("interface")}
            createTitle="New Interface"
          >
            {interfaces.map((iface) => (
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
          </Section>

          <Section
            title="Enums"
            count={enums.length}
            onCreate={() => handleCreate("enum")}
            createTitle="New Enum"
          >
            {enums.map((en) => (
              <ElementRow
                key={en.id}
                id={en.id}
                name={en.name}
                badge="E"
                badgeClass="bg-amber-500/20 text-amber-400"
                onShowContextMenu={handleShowContextMenu}
              />
            ))}
          </Section>
        </div>
      )}

      {ctxMenu && (
        <div
          className="fixed z-[9000] bg-[#1a2235] border border-[#2d3f5c] rounded-lg shadow-2xl py-1 min-w-[180px]"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
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
    </div>
  );
}
