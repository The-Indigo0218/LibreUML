import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Wand2 } from "lucide-react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import type { stereotype, UmlRelationType } from "../../types/diagram.types";
import { edgeConfig } from "../../../../config/theme.config";
import { useTranslation } from "react-i18next";
import { getDiagramRegistry, getAllTools } from "../../../../core/registry/diagram-registry";
import type { ToolConfig } from "../../../../core/registry/diagram-registry.types";
import { getIconComponent } from "../../../../core/registry/icon-map";
import { useKonvaAutoLayout } from "../../../../canvas/hooks/useKonvaAutoLayout";
import { DRAG_TYPE_NEW } from "../../../../canvas/hooks/useKonvaDnD";
import { isDiagramView } from "../../hooks/useVFSCanvasController";
import type { VFSFile } from "../../../../core/domain/vfs/vfs.types";
import { getRelationShortcutKey } from "../../../../canvas/interactions/relationShortcuts";
import {
  insertFragmentIntoActiveDiagram,
  insertInteractionUseIntoActiveDiagram,
  insertEndpointMessageIntoActiveDiagram,
  insertGeneralOrderingIntoActiveDiagram,
  insertTimeConstraintIntoActiveDiagram,
  insertCoregionIntoActiveDiagram,
} from "../../services/sequenceInserts";

export default function ToolPalette() {
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const { runLayout } = useKonvaAutoLayout();

  const diagramType = (() => {
    if (activeTabId && project) {
      const node = project.nodes[activeTabId];
      if (node?.type === 'FILE' && node.diagramType) return node.diagramType;
    }
    return 'CLASS_DIAGRAM';
  })();

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

  const hideForeign = !!registry.hideForeignTools;

  const nativeNodeIds = useMemo(
    () => new Set(registry.tools.nodes.map((tool) => tool.id)),
    [registry],
  );

  const fragmentTools = registry.tools.fragments ?? [];
  const structureTools = registry.tools.structure ?? [];

  // The density pill governs how much of the palette is shown. It appears only
  // for diagrams that have a common/advanced split to control (sequence today).
  const [density, setDensity] = useState<Density>('basic');
  const showDensityPill = fragmentTools.length > 0 || structureTools.length > 0;
  const showAdvanced = !showDensityPill || density !== 'basic';
  // Foreign tools from other diagram types: always listed (dimmed) on diagrams
  // without the pill (#1); on piloted diagrams only at the "all" level, unless
  // the diagram opts out entirely via hideForeignTools.
  const showForeign = showDensityPill ? density === 'all' && !hideForeign : !hideForeign;

  // Native node tools first; foreign ones (when shown) are dimmed and sorted
  // last, and dropping one triggers the cross-diagram guard in useKonvaDnD.
  const nodeTools = useMemo(() => {
    if (!showForeign) return registry.tools.nodes;
    return [...getAllTools().nodes].sort((a, b) => {
      const aForeign = nativeNodeIds.has(a.id) ? 0 : 1;
      const bForeign = nativeNodeIds.has(b.id) ? 0 : 1;
      return aForeign - bForeign;
    });
  }, [showForeign, registry, nativeNodeIds]);

  const commonFragments = fragmentTools.filter((tool) => tool.category !== 'advanced');
  const advancedFragments = fragmentTools.filter((tool) => tool.category === 'advanced');
  const commonStructure = structureTools.filter((tool) => tool.category !== 'advanced');
  const advancedStructure = structureTools.filter((tool) => tool.category === 'advanced');

  const insertStructureTool = (id: string) => {
    if (id === 'ref') insertInteractionUseIntoActiveDiagram();
    else if (id === 'msg-found') insertEndpointMessageIntoActiveDiagram('found');
    else if (id === 'msg-lost') insertEndpointMessageIntoActiveDiagram('lost');
    else if (id === 'gen-ordering') insertGeneralOrderingIntoActiveDiagram();
    else if (id === 'duration') insertTimeConstraintIntoActiveDiagram('duration');
    else if (id === 'time') insertTimeConstraintIntoActiveDiagram('time');
    else if (id === 'coregion') insertCoregionIntoActiveDiagram();
  };

  const setTabConnectionMode = useWorkspaceStore((s) => s.setTabConnectionMode);

  const activeConnectionMode = useWorkspaceStore((s) => {
    const tabId = s.activeTabId;
    if (!tabId) return 'association' as UmlRelationType;
    return ((s.connectionModes?.[tabId] ?? 'association') as string).toLowerCase() as UmlRelationType;
  });

  const setConnectionMode = (mode: UmlRelationType) => {
    const tabId = useWorkspaceStore.getState().activeTabId;
    if (!tabId) return;
    setTabConnectionMode(tabId, mode.toUpperCase());
  };

  const [isNodesOpen, setIsNodesOpen] = useState(true);
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(true);
  const [isFragmentsOpen, setIsFragmentsOpen] = useState(true);
  const [isStructureOpen, setIsStructureOpen] = useState(true);

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
        {showDensityPill && (
          <DensityPill
            value={density}
            onChange={setDensity}
            labels={{
              basic: t("sidebar.density.basic"),
              advanced: t("sidebar.density.advanced"),
              all: t("sidebar.density.all"),
            }}
          />
        )}

        <CollapsibleSection
          title="Nodes"
          isOpen={isNodesOpen}
          setIsOpen={setIsNodesOpen}
        >
          <div className="flex flex-col gap-2 px-3">
            {nodeTools.map((tool) => (
              <DraggableItem
                key={tool.id}
                type={tool.id as stereotype}
                icon={tool.icon}
                label={tool.translationKey ? t(tool.translationKey) : tool.label}
                color={tool.color || 'var(--color-uml-class-border)'}
                onDragStart={onDragStart}
                isForeign={!nativeNodeIds.has(tool.id)}
                foreignHint={t("sidebar.otherDiagram")}
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
                  shortcutKey={getRelationShortcutKey(tool.id)}
                />
              );
            })}
          </div>

        </CollapsibleSection>

        <InsertSection
          common={commonFragments}
          advanced={advancedFragments}
          showAdvanced={showAdvanced}
          title={t("sidebar.fragments.title")}
          isOpen={isFragmentsOpen}
          setIsOpen={setIsFragmentsOpen}
          onInsert={(tool) => insertFragmentIntoActiveDiagram(tool.fragmentKind!)}
        />

        <InsertSection
          common={commonStructure}
          advanced={advancedStructure}
          showAdvanced={showAdvanced}
          title={t("sidebar.structure.title")}
          isOpen={isStructureOpen}
          setIsOpen={setIsStructureOpen}
          onInsert={(tool) => insertStructureTool(tool.id)}
        />
      </div>
    </div>
  );
}

type Density = 'basic' | 'advanced' | 'all';

interface DensityPillProps {
  value: Density;
  onChange: (value: Density) => void;
  labels: Record<Density, string>;
}

/** Segmented control governing how much of the palette is shown. */
function DensityPill({ value, onChange, labels }: DensityPillProps) {
  const levels: Density[] = ['basic', 'advanced', 'all'];
  return (
    <div className="flex items-center gap-0.5 mx-3 mb-2 p-0.5 rounded-md bg-surface-secondary/40 border border-surface-border/40">
      {levels.map((level) => (
        <button
          key={level}
          onClick={() => onChange(level)}
          className={`flex-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded transition-colors ${
            value === level
              ? "bg-indigo-500/25 text-indigo-200"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          {labels[level]}
        </button>
      ))}
    </div>
  );
}

interface InsertSectionProps {
  common: ToolConfig[];
  advanced: ToolConfig[];
  /** Whether the advanced tools are visible (driven by the density pill). */
  showAdvanced: boolean;
  title: string;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  onInsert: (tool: ToolConfig) => void;
}

/**
 * A collapsible palette section of click-to-insert tools (operators / structure).
 * Common tools always show; advanced ones appear when the density pill allows it.
 * Renders nothing when the section has no tools.
 */
function InsertSection({
  common,
  advanced,
  showAdvanced,
  title,
  isOpen,
  setIsOpen,
  onInsert,
}: InsertSectionProps) {
  if (common.length === 0 && advanced.length === 0) return null;

  const visible = showAdvanced ? [...common, ...advanced] : common;

  return (
    <>
      <div className="mx-4 my-2 h-px bg-surface-border/30" />
      <CollapsibleSection title={title} isOpen={isOpen} setIsOpen={setIsOpen}>
        <div className="flex flex-col gap-2 px-3">
          {visible.map((tool) => (
            <InsertItem key={tool.id} tool={tool} onInsert={() => onInsert(tool)} />
          ))}
        </div>
      </CollapsibleSection>
    </>
  );
}

interface InsertItemProps {
  tool: ToolConfig;
  onInsert: () => void;
}

/** Click-to-insert palette row for a fragment operator or structural extra. */
function InsertItem({ tool, onInsert }: InsertItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const color = tool.color || '#6366F1';
  const IconComponent = getIconComponent(tool.icon);

  return (
    <button
      title={tool.label}
      onClick={onInsert}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group flex items-center cursor-pointer rounded-lg transition-all duration-200 border flex-row gap-3 px-3 py-2 justify-start"
      style={{
        borderColor: isHovered ? color : "transparent",
        backgroundColor: isHovered ? `color-mix(in srgb, ${color} 15%, transparent)` : "transparent",
      }}
    >
      <span style={{ color }} className="group-hover:brightness-125 transition-all shrink-0">
        {IconComponent && <IconComponent className="w-4 h-4" />}
      </span>
      <span
        className="font-mono font-semibold text-sm"
        style={{ color: isHovered ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
      >
        {tool.label}
      </span>
    </button>
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
  /** True when the tool is not native to the active diagram type. */
  isForeign?: boolean;
  /** Tooltip suffix shown for foreign tools (e.g. "from another diagram"). */
  foreignHint?: string;
}

function DraggableItem({
  type,
  icon,
  label,
  color,
  onDragStart,
  isForeign = false,
  foreignHint,
}: DraggableItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Get icon component dynamically
  const IconComponent = getIconComponent(icon);

  return (
    <div
      title={isForeign && foreignHint ? `${label} · ${foreignHint}` : label}
      className={`group flex items-center cursor-grab active:cursor-grabbing rounded-lg transition-all duration-200 border flex-row gap-3 px-3 py-2.5 justify-start ${isForeign ? "opacity-50 hover:opacity-100" : ""}`}
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

      {isForeign && (
        <span
          className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400/70"
          aria-hidden
        />
      )}
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
  /** Single-key shortcut (uppercase) that activates this tool, or null. */
  shortcutKey?: string | null;
}

function ConnectionItem({
  mode,
  activeMode,
  onClick,
  icon,
  label,
  color,
  shortcutKey,
}: ConnectionItemProps) {
  const isActive = activeMode === mode;
  const [isHovered, setIsHovered] = useState(false);
  
  // Get icon component dynamically
  const IconComponent = getIconComponent(icon);
  
  // Special handling for filled diamond (composition)
  const isFilled = mode === 'composition';

  return (
    <button
      title={shortcutKey ? `${label} (${shortcutKey})` : label}
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

      {shortcutKey && (
        <kbd
          className="ml-auto px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded border shrink-0"
          style={{
            color: isActive ? "#0B0F1A" : "#9CA3AF",
            borderColor: isActive ? "#0B0F1A33" : "#9CA3AF33",
            backgroundColor: isActive ? "#0B0F1A14" : "transparent",
          }}
        >
          {shortcutKey}
        </kbd>
      )}
    </button>
  );
}