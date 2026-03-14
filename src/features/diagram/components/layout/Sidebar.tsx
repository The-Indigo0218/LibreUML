import { useState, useMemo } from "react";
import {
  Box,
  CircleDot,
  BoxSelect,
  StickyNote,
  List,
  ArrowUpRight,
  GitCommitHorizontal,
  ArrowUp,
  MoveRight,
  ChevronDown,
  ChevronRight,
  Diamond,
} from "lucide-react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useProjectStore } from "../../../../store/project.store";
import { useShallow } from "zustand/react/shallow";
import { Folder, FolderOpen as FolderOpenIcon, FileJson } from "lucide-react";
import type { stereotype, UmlRelationType } from "../../types/diagram.types";
import { edgeConfig } from "../../../../config/theme.config";
import { useTranslation } from "react-i18next";

export default function Sidebar() {
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const updateFile = useWorkspaceStore((s) => s.updateFile);

  const activeConnectionMode = useWorkspaceStore((s) => {
    if (!activeFileId) return 'association';
    const f = s.files.find(file => file.id === activeFileId);
    return ((f?.metadata as any)?.activeConnectionMode || 'association').toLowerCase();
  });

  const setConnectionMode = (mode: UmlRelationType) => {
    if (!activeFileId) return;
    const currentFile = useWorkspaceStore.getState().getFile(activeFileId);
    if (!currentFile) return;

    updateFile(activeFileId, {
      metadata: {
        ...(currentFile.metadata || {}),
        activeConnectionMode: mode.toUpperCase() as any,
      },
    });
  };

  const [isNodesOpen, setIsNodesOpen] = useState(true);
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(true);
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});

  const activeFileNodeIds = useWorkspaceStore(useShallow(s => {
    if (!s.activeFileId) return [];
    return s.getFile(s.activeFileId)?.nodeIds || [];
  }));

  const activeNodes = useProjectStore(useShallow(s => {
    return activeFileNodeIds.map(id => s.nodes[id]).filter(Boolean);
  }));

  const fileEdgeIds = useWorkspaceStore(useShallow(s => s.activeFileId ? s.getFile(s.activeFileId)?.edgeIds || [] : []));
  const edges = useProjectStore(useShallow(s => 
    fileEdgeIds.map(id => s.edges[id]).filter(Boolean)
  ));

  const packages = useMemo(() => {
    const map = new Map<string, typeof activeNodes>();
    activeNodes.forEach(node => {
      const pkg = (node as any).package || "default";
      if (!map.has(pkg)) map.set(pkg, []);
      map.get(pkg)!.push(node);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [activeNodes]);

  const inheritanceSourceIds = useMemo(() => {
    const set = new Set<string>();
    edges.forEach(edge => {
      if (edge.type === "INHERITANCE") {
        set.add(edge.sourceNodeId);
      }
    });
    return set;
  }, [edges]);

  const isSubclass = (nodeId: string) => {
    return inheritanceSourceIds.has(nodeId);
  };

  const togglePackage = (pkg: string) => {
    setExpandedPackages(prev => ({ ...prev, [pkg]: !prev[pkg] }));
  };

  const { t } = useTranslation();

  const onDragStart = (event: React.DragEvent, nodeType: stereotype) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2d2d]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#cccccc]">
          {t("sidebar.toolbox")}
        </span>
      </div>

      <div className="flex flex-col py-2 overflow-y-auto overflow-x-hidden custom-scrollbar h-full select-none">
        {/* === SECTION 1: NODES === */}
        <CollapsibleSection
          title="Nodes"
          isOpen={isNodesOpen}
          setIsOpen={setIsNodesOpen}
        >
          <div className="flex flex-col gap-2 px-3">
            <DraggableItem
              type="class"
              icon={<Box className="w-5 h-5" />}
              label={t("sidebar.nodes.class")}
              color="var(--color-uml-class-border)"
              onDragStart={onDragStart}
            />
            <DraggableItem
              type="interface"
              icon={<CircleDot className="w-5 h-5" />}
              label={t("sidebar.nodes.interface")}
              color="var(--color-uml-interface-border)"
              onDragStart={onDragStart}
            />
            <DraggableItem
              type="abstract"
              icon={<BoxSelect className="w-5 h-5" />}
              label={t("sidebar.nodes.abstract")}
              color="var(--color-uml-abstract-border)"
              onDragStart={onDragStart}
            />
            <DraggableItem
              type="enum"
              icon={<List className="w-5 h-5" />}
              label="Enum"
              color="#A855F7"
              onDragStart={onDragStart}
            />
            <DraggableItem
              type="note"
              icon={<StickyNote className="w-5 h-5" />}
              label={t("sidebar.nodes.note")}
              color="var(--color-uml-note-border)"
              onDragStart={onDragStart}
            />
          </div>
        </CollapsibleSection>

        <div className="mx-4 my-2 h-px bg-surface-border/30" />

        {/* === Section 2: relationships === */}
        <CollapsibleSection
          title={t("sidebar.connections.title")}
          isOpen={isConnectionsOpen}
          setIsOpen={setIsConnectionsOpen}
        >
          <div className="flex flex-col gap-2 px-3">
            <ConnectionItem
              mode="association"
              activeMode={activeConnectionMode}
              onClick={() => setConnectionMode("association")}
              icon={<MoveRight className="w-5 h-5" />}
              label={t("sidebar.connections.association")}
              color={edgeConfig.types.association.highlight}
            />

            <ConnectionItem
              mode="inheritance"
              activeMode={activeConnectionMode}
              onClick={() => setConnectionMode("inheritance")}
              icon={<ArrowUp className="w-5 h-5" />}
              label={t("sidebar.connections.inheritance")}
              color={edgeConfig.types.inheritance.highlight}
            />

            <ConnectionItem
              mode="implementation"
              activeMode={activeConnectionMode}
              onClick={() => setConnectionMode("implementation")}
              icon={<ArrowUpRight className="w-5 h-5" />}
              label={t("sidebar.connections.implementation")}
              color={edgeConfig.types.implementation.highlight}
            />

            <ConnectionItem
              mode="dependency"
              activeMode={activeConnectionMode}
              onClick={() => setConnectionMode("dependency")}
              icon={<GitCommitHorizontal className="w-5 h-5" />}
              label={t("sidebar.connections.dependency")}
              color={edgeConfig.types.dependency.highlight}
            />

            <ConnectionItem
              mode="aggregation"
              activeMode={activeConnectionMode}
              onClick={() => setConnectionMode("aggregation")}
              icon={<Diamond className="w-5 h-5" />}
              label={t("sidebar.connections.aggregation")}
              color={edgeConfig.types.aggregation.highlight}
            />

            <ConnectionItem
              mode="composition"
              activeMode={activeConnectionMode}
              onClick={() => setConnectionMode("composition")}
              icon={<Diamond className="w-5 h-5 fill-current" />}
              label={t("sidebar.connections.composition")}
              color={edgeConfig.types.composition.highlight}
            />
          </div>

          <div className="p-4 border-t border-surface-border bg-surface-secondary/30 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
              {t("sidebar.legend.title")}
            </div>
            <div className="flex flex-col gap-2">
              {/* Source Legend */}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-sm shadow-sm ring-1 ring-blue-500/30"></div>
                <span className="text-xs text-text-secondary">
                  <span className="font-semibold text-text-primary">
                    {t("sidebar.legend.blue")}
                  </span>{" "}
                  {t("sidebar.legend.source")}
                </span>
              </div>

              {/* Target Legend */}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-sm shadow-sm ring-1 ring-green-500/30"></div>
                <span className="text-xs text-text-secondary">
                  <span className="font-semibold text-text-primary">
                    {t("sidebar.legend.green")}
                  </span>{" "}
                  {t("sidebar.legend.target")}
                </span>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <div className="mx-4 my-2 h-px bg-surface-border/30" />

        {/* === Section 3: Project Explorer === */}
        <CollapsibleSection
          title="Project Explorer"
          isOpen={isExplorerOpen}
          setIsOpen={setIsExplorerOpen}
        >
          <div className="flex flex-col gap-1 px-3 pb-2 text-sm text-text-secondary select-none">
            {activeNodes.length === 0 ? (
              <div className="px-3 py-2 text-xs italic text-text-muted">No classes in project</div>
            ) : (
              packages.map(([pkgName, pkgNodes]) => {
                const isExpanded = expandedPackages[pkgName] !== false;
                return (
                  <div key={pkgName} className="flex flex-col">
                    {/* Package Header */}
                    <div 
                      className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-surface-secondary/50 rounded-md group transition-colors"
                      onClick={() => togglePackage(pkgName)}
                    >
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                      {isExpanded ? (
                        <FolderOpenIcon className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
                      ) : (
                        <Folder className="w-4 h-4 text-blue-400 group-hover:text-blue-300 fill-current opacity-70" />
                      )}
                      <span className="font-semibold text-[13px] text-text-primary truncate">{pkgName}</span>
                      <span className="text-[10px] text-text-muted ml-auto bg-surface-tertiary px-1.5 rounded">{pkgNodes.length}</span>
                    </div>

                    {/* Nodes within Package */}
                    <div 
                      className={`flex flex-col overflow-hidden transition-all duration-300 ease-in-out pl-6 border-l border-surface-border/50 ml-4 ${
                        isExpanded ? "max-h-96 opacity-100 mt-1 mb-2" : "max-h-0 opacity-0 m-0"
                      }`}
                    >
                      {pkgNodes.sort((a,b) => ((a as any).name || "").localeCompare((b as any).name || "")).map(node => {
                        const subclass = isSubclass(node.id);
                        return (
                          <div 
                            key={node.id} 
                            title={subclass ? "Sub-class" : undefined}
                            className="flex items-center gap-2 pl-2 pr-2 py-1 hover:bg-surface-secondary rounded cursor-pointer group"
                          >
                            {subclass ? (
                              <ArrowUp className="w-3.5 h-3.5 text-edge-inheritance" />
                            ) : (
                              <FileJson className="w-3.5 h-3.5 text-text-muted group-hover:text-blue-300" />
                            )}
                            <span className={`text-[12px] truncate ${subclass ? 'text-text-primary ml-1' : 'text-text-secondary'}`}>
                              {(node as any).name || "Unnamed"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  isOpen,
  setIsOpen,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="flex flex-col">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider hover:text-text-primary transition-colors group"
      >
        <span>{title}</span>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-text-secondary group-hover:text-text-primary transition-transform" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-secondary group-hover:text-text-primary transition-transform" />
        )}
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-96 opacity-100 mb-2" : "max-h-0 opacity-0"}`}
      >
        {children}
      </div>
    </div>
  );
}

interface DraggableItemProps {
  type: stereotype;
  icon: React.ReactNode;
  label: string;
  color: string;
  onDragStart: (event: React.DragEvent, type: stereotype) => void;
}

function DraggableItem({
  type,
  icon,
  label,
  color,
  onDragStart,
}: DraggableItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      title={label}
      className="group flex items-center cursor-grab active:cursor-grabbing rounded-lg transition-all duration-200 border flex-row gap-3 px-3 py-2.5 justify-start"
      draggable
      onDragStart={(e) => onDragStart(e, type)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderColor: isHovered ? color : "transparent",
        backgroundColor: isHovered ? `color-mix(in srgb, ${color} 15%, transparent)` : "transparent",
      }}
    >
      <div className="transition-colors">
        <span
          style={{ color: color }}
          className="group-hover:brightness-125 transition-all"
        >
          {icon}
        </span>
      </div>

      <span
        className="font-medium text-sm transition-all whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200"
        style={{ color: isHovered ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}

interface ConnectionItemProps {
  mode: UmlRelationType;
  activeMode: UmlRelationType;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
}

function ConnectionItem({
  mode,
  activeMode,
  onClick,
  icon,
  label,
  color,
}: ConnectionItemProps) {
  const isActive = activeMode === mode;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      title={label}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group flex items-center rounded-lg transition-all duration-200 border flex-row gap-3 px-3 py-2.5 justify-start"
      style={{
        borderColor: isActive || isHovered
          ? color
          : `color-mix(in srgb, ${color} 30%, transparent)`,
        backgroundColor: isActive
          ? color
          : isHovered
          ? `color-mix(in srgb, ${color} 15%, transparent)`
          : "transparent",
      }}
    >
      <div
        className="transition-colors shrink-0"
        style={{ color: isActive ? "#0B0F1A" : color }}
      >
        <span
          style={{
            color: isActive ? "#111827" : color,
            fontWeight: "bold",
          }}
        >
          {icon}
        </span>
      </div>

      <span
        className="font-medium text-sm transition-colors whitespace-nowrap"
        style={{ color: isActive ? "#0B0F1A" : "#9CA3AF" }}
      >
        {label}
      </span>
    </button>
  );
}