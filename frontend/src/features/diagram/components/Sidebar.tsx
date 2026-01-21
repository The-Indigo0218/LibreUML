import { useState } from "react";
import {
  Box,
  CircleDot,
  BoxSelect,
  StickyNote,
  ArrowUpRight,
  GitCommitHorizontal,
  ArrowUp,
  MoveRight,
  SquareChevronRight,
  SquareChevronLeft,
  PanelLeft,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useDiagramStore } from "../../../store/diagramStore";
import type { stereotype, UmlRelationType } from "../../../types/diagram.types";
import { edgeConfig } from "../../../config/theme.config";
import { useTranslation } from "react-i18next";

export default function Sidebar() {
  const { activeConnectionMode, setConnectionMode } = useDiagramStore();

  const [isExpanded, setIsExpanded] = useState(false);

  const [isNodesOpen, setIsNodesOpen] = useState(true);
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(true);

  const { t } = useTranslation();

  const onDragStart = (event: React.DragEvent, nodeType: stereotype) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside
      className={`
        relative bg-surface-primary border-r border-surface-border flex flex-col z-10 shadow-xl transition-all duration-300 ease-in-out
        ${isExpanded ? "w-64" : "w-16"}
      `}
    >
      {/* ---  DINAMIC HEADER --- */}
      <div
        className={`
        h-14 flex items-center border-b border-surface-border/50 transition-all duration-300
        ${isExpanded ? "justify-between px-4" : "justify-center"}
      `}
      >
        {isExpanded && (
          <div className="flex items-center gap-2 animate-in fade-in duration-300">
            <PanelLeft className="w-5 h-5 text-uml-class-border" />
            <span className="font-bold text-text-primary tracking-tight">
              {t("sidebar.toolbox")}
            </span>
          </div>
        )}

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
             flex items-center justify-center 
             rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:scale-105
             transition-all duration-200
             ${isExpanded ? "p-1.5 bg-transparent border border-surface-border" : "w-8 h-8 bg-surface-secondary border border-surface-border"}
           `}
          title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {isExpanded ? (
            <SquareChevronLeft className="w-5 h-5" />
          ) : (
            <SquareChevronRight className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="flex flex-col py-2 overflow-y-auto overflow-x-hidden custom-scrollbar h-full select-none">
        {/* === SECTION 1: NODES === */}
        <CollapsibleSection
          title="Nodes"
          isOpen={isNodesOpen}
          setIsOpen={setIsNodesOpen}
          isSidebarExpanded={isExpanded}
        >
          <div
            className={`flex flex-col gap-2 ${isExpanded ? "px-3" : "px-2"}`}
          >
            <DraggableItem
              type="class"
              icon={<Box className={isExpanded ? "w-5 h-5" : "w-6 h-6"} />}
              label={t("sidebar.nodes.class")}
              color="var(--color-uml-class-border)"
              isExpanded={isExpanded}
              onDragStart={onDragStart}
            />
            <DraggableItem
              type="interface"
              icon={
                <CircleDot className={isExpanded ? "w-5 h-5" : "w-6 h-6"} />
              }
              label={t("sidebar.nodes.interface")}
              color="var(--color-uml-interface-border)"
              isExpanded={isExpanded}
              onDragStart={onDragStart}
            />
            <DraggableItem
              type="abstract"
              icon={
                <BoxSelect className={isExpanded ? "w-5 h-5" : "w-6 h-6"} />
              }
              label={t("sidebar.nodes.abstract")}
              color="var(--color-uml-abstract-border)"
              isExpanded={isExpanded}
              onDragStart={onDragStart}
            />
            <DraggableItem
              type="note"
              icon={
                <StickyNote className={isExpanded ? "w-5 h-5" : "w-6 h-6"} />
              }
              label={t("sidebar.nodes.note")}
              color="var(--color-uml-note-border)"
              isExpanded={isExpanded}
              onDragStart={onDragStart}
            />
          </div>
        </CollapsibleSection>

        {isExpanded && <div className="mx-4 my-2 h-px bg-surface-border/30" />}

        {/* === Section 2: relationships === */}
        <CollapsibleSection
          title={t("sidebar.connections.title")}
          isOpen={isConnectionsOpen}
          setIsOpen={setIsConnectionsOpen}
          isSidebarExpanded={isExpanded}
        >
          <div
            className={`flex flex-col gap-2 ${isExpanded ? "px-3" : "px-2"}`}
          >
            <ConnectionItem
              mode="association"
              activeMode={activeConnectionMode}
              onClick={() => setConnectionMode("association")}
              icon={
                <MoveRight className={isExpanded ? "w-5 h-5" : "w-6 h-6"} />
              }
              label={t('sidebar.connections.association')}
              color={edgeConfig.types.association.highlight}
              isExpanded={isExpanded}
            />

            <ConnectionItem
              mode="inheritance"
              activeMode={activeConnectionMode}
              onClick={() => setConnectionMode("inheritance")}
              icon={<ArrowUp className={isExpanded ? "w-5 h-5" : "w-6 h-6"} />}
              label={t('sidebar.connections.inheritance')}
              color={edgeConfig.types.inheritance.highlight}
              isExpanded={isExpanded}
            />

            <ConnectionItem
              mode="implementation"
              activeMode={activeConnectionMode}
              onClick={() => setConnectionMode("implementation")}
              icon={
                <ArrowUpRight className={isExpanded ? "w-5 h-5" : "w-6 h-6"} />
              }
              label={t('sidebar.connections.implementation')}
              color={edgeConfig.types.implementation.highlight}
              isExpanded={isExpanded}
            />

            <ConnectionItem
              mode="dependency"
              activeMode={activeConnectionMode}
              onClick={() => setConnectionMode("dependency")}
              icon={
                <GitCommitHorizontal
                  className={isExpanded ? "w-5 h-5" : "w-6 h-6"}
                />
              }
              label={t('sidebar.connections.dependency')}
              color={edgeConfig.types.dependency.highlight}
              isExpanded={isExpanded}
            />
          </div>

          {isExpanded && (
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
          )}
        </CollapsibleSection>
      </div>
    </aside>
  );
}

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  isSidebarExpanded: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  isOpen,
  setIsOpen,
  isSidebarExpanded,
  children,
}: CollapsibleSectionProps) {
  if (!isSidebarExpanded) {
    return (
      <div className="py-2 flex flex-col gap-1 items-center animate-in fade-in zoom-in duration-200">
        <div className="w-8 h-px bg-surface-border/50 mb-2" />
        {children}
      </div>
    );
  }

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
  isExpanded: boolean;
  onDragStart: (event: React.DragEvent, type: stereotype) => void;
}

function DraggableItem({
  type,
  icon,
  label,
  color,
  isExpanded,
  onDragStart,
}: DraggableItemProps) {
  return (
    <div
      className={`
        group flex items-center cursor-grab active:cursor-grabbing rounded-lg hover:bg-surface-secondary transition-all duration-200 border border-transparent
        ${isExpanded ? "flex-row gap-3 px-3 py-2.5 justify-start" : "flex-col gap-1 p-2 justify-center"}
      `}
      draggable
      onDragStart={(e) => onDragStart(e, type)}
    >
      <div
        className="text-text-secondary group-hover:text-white transition-colors"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <span
          style={{ color: color }}
          className="group-hover:brightness-125 transition-all"
        >
          {icon}
        </span>
      </div>

      {isExpanded && (
        <span className="font-medium text-sm text-text-muted group-hover:text-text-primary transition-all whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200">
          {label}
        </span>
      )}
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
  isExpanded: boolean;
}

function ConnectionItem({
  mode,
  activeMode,
  onClick,
  icon,
  label,
  color,
  isExpanded,
}: ConnectionItemProps) {
  const isActive = activeMode === mode;

  return (
    <button
      onClick={onClick}
      className={`
        group flex items-center rounded-lg transition-all duration-200 border
        ${isExpanded ? "flex-row gap-3 px-3 py-2.5 justify-start" : "flex-col gap-1 p-2 justify-center"}
      `}
      style={{
        borderColor: isActive ? color : color.replace(")", ", 0.3)"),
        backgroundColor: isActive ? color : "transparent",
      }}
    >
      <div
        className="transition-colors shrink-0"
        style={{ color: isActive ? "#0B0F1A" : color }}
      >
        <span
          style={{ color: isActive ? "#111827" : color, fontWeight: "bold" }}
        >
          {icon}
        </span>
      </div>

      {isExpanded && (
        <span
          className="font-medium text-sm transition-colors whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200"
          style={{ color: isActive ? "#111827" : "var(--color-text-muted)" }}
        >
          {label}
        </span>
      )}
    </button>
  );
}
