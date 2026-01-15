import { useState, useRef } from "react";
import type { stereotype } from "../../../types/diagram.types";
import {
  Box,
  FileCode,
  Component,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowUpFromLine,
  GitCommitHorizontal,
  MousePointer2,
  StickyNote
} from "lucide-react";

import { DraggableItem, ClickableItem } from "./SidebarItem";
import { useDiagramStore } from "../../../store/diagramStore";

export default function Sidebar() {
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    structure: true,
    relationships: true,
  });

  const { activeConnectionMode, setConnectionMode } = useDiagramStore();
  const ghostRef = useRef<HTMLDivElement>(null);

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const onDragStart = (event: React.DragEvent, nodeType: stereotype) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/reactflow", nodeType);

    if (ghostRef.current) {
      event.dataTransfer.setDragImage(ghostRef.current, 75, 25);
    }
  };

  return (
    <aside className="w-64 bg-surface-primary border-r border-surface-border flex flex-col h-full text-text-secondary select-none shadow-xl z-10 font-sans">
      
      {/* HEADER */}
      <div className="p-4 border-b border-surface-border flex items-center gap-2">
        <MousePointer2 className="w-5 h-5 text-uml-class-border" />
        <h2 className="text-sm font-bold text-text-primary tracking-wide uppercase">
          Toolbox
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <div className="mb-2">
          <button
            onClick={() => toggleSection("structure")}
            className="flex items-center w-full p-2 text-xs font-bold uppercase text-text-muted hover:text-text-primary transition-colors mb-1"
          >
            {openSections["structure"] ? (
              <ChevronDown className="w-4 h-4 mr-1" />
            ) : (
              <ChevronRight className="w-4 h-4 mr-1" />
            )}
            Structure
          </button>

          {openSections["structure"] && (
            <div className="grid grid-cols-1 gap-2 pl-2">
              <DraggableItem
                label="Class"
                icon={<Box className="w-4 h-4 text-uml-class-border" />} // Índigo
                type="class"
                onDragStart={onDragStart}
              />
              <DraggableItem
                label="Interface"
                icon={<FileCode className="w-4 h-4 text-uml-interface-border" />} // Cyan
                type="interface"
                onDragStart={onDragStart}
              />
              <DraggableItem
                label="Abstract"
                icon={<Component className="w-4 h-4 text-uml-abstract-border" />} // Azul Claro
                type="abstract"
                onDragStart={onDragStart}
              />
              <div className="h-px bg-surface-border my-1" /> 
              <DraggableItem 
                label="Note / Comment" 
                icon={<StickyNote className="w-4 h-4 text-uml-note-border" />} // Cyan Brillante
                type="note" 
                onDragStart={onDragStart} 
              />
            </div>
          )}
        </div>

        {/* SECTION: RELATIONSHIPS */}
        <div className="mb-2">
          <button
            onClick={() => toggleSection("relationships")}
            className="flex items-center w-full p-2 text-xs font-bold uppercase text-text-muted hover:text-text-primary transition-colors mb-1"
          >
             {openSections["relationships"] ? (
              <ChevronDown className="w-4 h-4 mr-1" />
            ) : (
              <ChevronRight className="w-4 h-4 mr-1" />
            )}
            Relationships
          </button>

          {openSections["relationships"] && (
            <div className="grid grid-cols-1 gap-2 pl-2">
              
              <div className="mb-2 p-2 bg-surface-secondary rounded border border-surface-border text-[10px] text-text-muted flex items-center justify-between mx-1">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.8)]"></div>
                  <span>Source</span>
                </div>
                <ArrowRight className="w-3 h-3 text-text-muted" />
                <div className="flex items-center gap-1">
                  <span>Target</span>
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.8)]"></div>
                </div>
              </div>

              <ClickableItem
                label="Association"
                icon={<ArrowRight className="w-4 h-4" />}
                isActive={activeConnectionMode === "association"}
                onClick={() => setConnectionMode("association")}
              />
              <ClickableItem
                label="Inheritance"
                icon={<ArrowUpFromLine className="w-4 h-4" />}
                isActive={activeConnectionMode === "inheritance"}
                onClick={() => setConnectionMode("inheritance")}
              />
              <ClickableItem
                label="Implementation"
                icon={<GitCommitHorizontal className="w-4 h-4" />}
                isActive={activeConnectionMode === "implementation"}
                onClick={() => setConnectionMode("implementation")}
              />
              <ClickableItem
                label="Dependency"
                icon={
                  <ArrowRight className="w-4 h-4 border-b border-dashed border-transparent" />
                }
                isActive={activeConnectionMode === "dependency"}
                onClick={() => setConnectionMode("dependency")}
              />
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="p-4 border-t border-surface-border text-[10px] text-text-muted text-center">
        LibreUML v0.1.0 Alpha
      </div>

      <div
        ref={ghostRef}
        className="fixed -top-250 left-0 w-40 h-15 bg-uml-class-bg border-2 border-uml-class-border rounded-md flex items-center justify-center shadow-2xl z-50 pointer-events-none"
      >
        <div className="flex flex-col items-center w-full px-2">
          <div className="w-full h-2 bg-surface-hover border-b border-uml-class-border mb-1 rounded-sm"></div>
          <span className="text-text-primary font-bold text-xs bg-transparent px-2 rounded">
            New Node...
          </span>
        </div>
      </div>
    </aside>
  );
}