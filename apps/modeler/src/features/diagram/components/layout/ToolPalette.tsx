import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Wand2 } from "lucide-react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import type { stereotype, UmlRelationType } from "../../types/diagram.types";
import { edgeConfig } from "../../../../config/theme.config";
import { useTranslation } from "react-i18next";
import { getDiagramRegistry } from "../../../../core/registry/diagram-registry";
import { getIconComponent } from "../../../../core/registry/icon-map";
import { useKonvaAutoLayout } from "../../../../canvas/hooks/useKonvaAutoLayout";
import { DRAG_TYPE_NEW } from "../../../../canvas/hooks/useKonvaDnD";
import { isDiagramView } from "../../hooks/useVFSCanvasController";
import type { VFSFile } from "../../../../core/domain/vfs/vfs.types";

export default function ToolPalette() {
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const getFile = useWorkspaceStore((s) => s.getFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const project = useVFSStore((s) => s.project);
  const { runLayout } = useKonvaAutoLayout();

  const activeFile = activeFileId ? getFile(activeFileId) : null;
  const diagramType = activeFile?.diagramType || 'CLASS_DIAGRAM';

  const isVFSDiagram = useMemo(() => {
    if (!activeTabId || !project) return false;
    const node = project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return false;
    return isDiagramView((node as VFSFile).content);
  }, [activeTabId, project]);

  const registry = useMemo(() => {
    try {
      return getDiagramRegistry(diagramType);
    } catch (error) {
      console.error('Failed to get diagram registry:', error);
      return getDiagramRegistry('CLASS_DIAGRAM'); // Fallback to CLASS_DIAGRAM
    }
  }, [diagramType]);

  const setTabConnectionMode = useWorkspaceStore((s) => s.setTabConnectionMode);

  const activeConnectionMode = useWorkspaceStore((s) => {
    const tabId = s.activeTabId;
    if (!tabId) return 'association' as UmlRelationType;
    return ((s.connectionModes?.[tabId] ?? 'association') as string).toLowerCase() as UmlRelationType;
  });

  const setConnectionMode = (mode: UmlRelationType) => {
    const tabId = useWorkspaceStore.getState().activeTabId;
    if (!tabId) return;
    const upperMode = mode.toUpperCase();
    setTabConnectionMode(tabId, upperMode);

    // Keep legacy file metadata in sync for useDiagram.ts compatibility
    if (activeFileId) {
      const currentFile = useWorkspaceStore.getState().getFile(activeFileId);
      if (currentFile) {
        updateFile(activeFileId, {
          metadata: {
            ...(currentFile.metadata || {}),
            activeConnectionMode: upperMode as any,
          },
        });
      }
    }
  };

  const [isNodesOpen, setIsNodesOpen] = useState(true);
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(true);

  const { t } = useTranslation();

  const onDragStart = (event: React.DragEvent, nodeType: stereotype) => {
    event.dataTransfer.setData(DRAG_TYPE_NEW, nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2d2d]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#cccccc]">
          {t("sidebar.toolbox")}
        </span>
        {isVFSDiagram && (
          <button
            onClick={runLayout}
            title="Auto Layout (Dagre TB)"
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/30 hover:border-indigo-400/60 transition-all active:scale-95"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Layout
          </button>
        )}
      </div>

      <div className="flex flex-col py-2 pb-4 overflow-y-auto overflow-x-hidden custom-scrollbar flex-1 select-none">
        <CollapsibleSection
          title="Nodes"
          isOpen={isNodesOpen}
          setIsOpen={setIsNodesOpen}
        >
          <div className="flex flex-col gap-2 px-3">
            {registry.tools.nodes.map((tool) => (
              <DraggableItem
                key={tool.id}
                type={tool.id as stereotype}
                icon={tool.icon}
                label={tool.translationKey ? t(tool.translationKey) : tool.label}
                color={tool.color || 'var(--color-uml-class-border)'}
                onDragStart={onDragStart}
              />
            ))}
          </div>
        </CollapsibleSection>

        <div className="mx-4 my-2 h-px bg-surface-border/30" />

        <CollapsibleSection
          title={t("sidebar.connections.title")}
          isOpen={isConnectionsOpen}
          setIsOpen={setIsConnectionsOpen}
        >
          <div className="flex flex-col gap-2 px-3 mb-2">
            {registry.tools.edges.map((tool) => {
              const edgeType = tool.id as UmlRelationType;
              const edgeStyle = edgeConfig.types[edgeType as keyof typeof edgeConfig.types];
              const color = edgeStyle?.highlight || 'var(--edge-base)';
              
              return (
                <ConnectionItem
                  key={tool.id}
                  mode={edgeType}
                  activeMode={activeConnectionMode}
                  onClick={() => setConnectionMode(edgeType)}
                  icon={tool.icon}
                  label={tool.translationKey ? t(tool.translationKey) : tool.label}
                  color={color}
                />
              );
            })}
          </div>

          <div className="px-4 py-4 pb-10 pt-6 border-t border-surface-border bg-surface-secondary/30">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">
              {t("sidebar.legend.title")}
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-sm shadow-sm ring-1 ring-blue-500/30 shrink-0"></div>
                <span className="text-xs text-text-secondary leading-relaxed">
                  <span className="font-semibold text-text-primary">
                    {t("sidebar.legend.blue")}
                  </span>{" "}
                  {t("sidebar.legend.source")}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-sm shadow-sm ring-1 ring-green-500/30 shrink-0"></div>
                <span className="text-xs text-text-secondary leading-relaxed">
                  <span className="font-semibold text-text-primary">
                    {t("sidebar.legend.green")}
                  </span>{" "}
                  {t("sidebar.legend.target")}
                </span>
              </div>
            </div>
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
        className={`overflow-visible transition-all duration-300 ease-in-out ${isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        {children}
      </div>
    </div>
  );
}

interface DraggableItemProps {
  type: stereotype;
  icon: string; // Icon name from Lucide
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
  
  // Get icon component dynamically
  const IconComponent = getIconComponent(icon);

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
          {IconComponent && <IconComponent className="w-5 h-5" />}
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
  icon: string; // Icon name from Lucide
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
  
  // Get icon component dynamically
  const IconComponent = getIconComponent(icon);
  
  // Special handling for filled diamond (composition)
  const isFilled = mode === 'composition';

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
          {IconComponent && <IconComponent className={`w-5 h-5 ${isFilled ? 'fill-current' : ''}`} />}
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