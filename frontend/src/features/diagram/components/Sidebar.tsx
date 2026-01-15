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
  PanelLeft
} from "lucide-react";
import { useDiagramStore } from "../../../store/diagramStore";
import type { stereotype, UmlRelationType } from "../../../types/diagram.types";
import { edgeConfig } from "../../../config/theme.config"; 

export default function Sidebar() {
  const { activeConnectionMode, setConnectionMode } = useDiagramStore();
  
  const [isExpanded, setIsExpanded] = useState(false);

  const onDragStart = (event: React.DragEvent, nodeType: stereotype) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside 
      className={`
        relative bg-surface-primary border-r border-surface-border flex flex-col z-10 shadow-xl transition-all duration-300 ease-in-out
        ${isExpanded ? "w-64" : "w-20"}
        /* Quitamos el pr-2 porque ya no hay botón flotante estorbando */
      `}
    >
      
      {/* --- HEADER CONSOLIDADO (TÍTULO + TOGGLE) --- */}
      <div className={`
        py-4 border-b border-surface-border/50 flex flex-col items-center justify-center transition-all gap-2
        ${isExpanded ? "px-4" : ""}
      `}>
         
         {/* 1. TÍTULO */}
         <div className={`flex items-center transition-all ${isExpanded ? "w-full justify-start gap-2" : "justify-center"}`}>
           {isExpanded ? (
             <>
               <PanelLeft className="w-5 h-5 text-uml-class-border" />
               <span className="font-bold text-text-primary tracking-tight">Toolbox</span>
             </>
           ) : (
             <span className="text-[10px] uppercase font-bold text-text-muted tracking-widest opacity-60">
               Tools
             </span>
           )}
         </div>

         {/* 2. BOTÓN TOGGLE (SUELTO / IN-FLOW) */}
         <button 
           onClick={() => setIsExpanded(!isExpanded)}
           className={`
             flex items-center justify-center 
             bg-surface-secondary border border-surface-border rounded-md 
             text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:scale-105
             shadow-sm transition-all duration-200
             ${isExpanded ? "w-full py-1.5" : "w-8 h-8"} /* Expandido: Barra ancha. Contraído: Botón cuadrado */
           `}
           title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
         >
           {isExpanded ? <SquareChevronLeft className="w-4 h-4" /> : <SquareChevronRight className="w-4 h-4" />}
         </button>

      </div>
      
      {/* --- CONTENIDO SCROLLABLE --- */}
      <div className="flex flex-col gap-6 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar h-full">
        
        {/* --- SECCIÓN 1: NODOS --- */}
        <div className="flex flex-col gap-2 px-2">
          {isExpanded && (
            <span className="px-2 text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Nodes
            </span>
          )}
          
          <DraggableItem
            type="class"
            icon={<Box className={isExpanded ? "w-5 h-5" : "w-6 h-6"} />}
            label="Class"
            color="var(--color-uml-class-border)"
            isExpanded={isExpanded}
            onDragStart={onDragStart}
          />
          <DraggableItem
            type="interface"
            icon={<CircleDot className={isExpanded ? "w-5 h-5" : "w-6 h-6"} />} 
            label="Interface"
            color="var(--color-uml-interface-border)"
            isExpanded={isExpanded}
            onDragStart={onDragStart}
          />
          <DraggableItem
            type="abstract"
            icon={<BoxSelect className={isExpanded ? "w-5 h-5" : "w-6 h-6"} />} 
            label="Abstract"
            color="var(--color-uml-abstract-border)"
            isExpanded={isExpanded}
            onDragStart={onDragStart}
          />
          <DraggableItem
            type="note"
            icon={<StickyNote className={isExpanded ? "w-5 h-5" : "w-6 h-6"} />} 
            label="Note"
            color="var(--color-uml-note-border)"
            isExpanded={isExpanded}
            onDragStart={onDragStart}
          />
        </div>

        <div className="mx-4 h-px bg-surface-border/50" />

        {/* --- SECCIÓN 2: RELACIONES --- */}
        <div className="flex flex-col gap-2 px-2">
          {isExpanded && (
            <span className="px-2 text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Connect
            </span>
          )}

          <ConnectionItem
            mode="association"
            activeMode={activeConnectionMode}
            onClick={() => setConnectionMode("association")}
            icon={<MoveRight className={isExpanded ? "w-5 h-5" : "w-5 h-5"} />}
            label="Association"
            color={edgeConfig.types.association.highlight} 
            isExpanded={isExpanded}
          />

          <ConnectionItem
            mode="inheritance"
            activeMode={activeConnectionMode}
            onClick={() => setConnectionMode("inheritance")}
            icon={<ArrowUp className={isExpanded ? "w-5 h-5" : "w-5 h-5"} />}
            label="Inheritance"
            color={edgeConfig.types.inheritance.highlight}
            isExpanded={isExpanded}
          />

          <ConnectionItem
            mode="implementation"
            activeMode={activeConnectionMode}
            onClick={() => setConnectionMode("implementation")}
            icon={<ArrowUpRight className={isExpanded ? "w-5 h-5" : "w-5 h-5"} />}
            label="Implement"
            color={edgeConfig.types.implementation.highlight}
            isExpanded={isExpanded}
          />

          <ConnectionItem
            mode="dependency"
            activeMode={activeConnectionMode}
            onClick={() => setConnectionMode("dependency")}
            icon={<GitCommitHorizontal className={isExpanded ? "w-5 h-5" : "w-5 h-5"} />}
            label="Dependency"
            color={edgeConfig.types.dependency.highlight}
            isExpanded={isExpanded}
          />
        </div>
      </div>
    </aside>
  );
}

// ... (Subcomponentes DraggableItem y ConnectionItem siguen igual) ...
interface DraggableItemProps {
  type: stereotype;
  icon: React.ReactNode;
  label: string;
  color: string;
  isExpanded: boolean;
  onDragStart: (event: React.DragEvent, type: stereotype) => void;
}

function DraggableItem({ type, icon, label, color, isExpanded, onDragStart }: DraggableItemProps) {
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
        <span style={{ color: color }} className="group-hover:brightness-125 transition-all">
            {icon}
        </span>
      </div>
      
      <span 
        className={`font-medium text-text-muted group-hover:text-text-primary transition-all whitespace-nowrap overflow-hidden
          ${isExpanded ? "text-sm opacity-100" : "text-[9px] opacity-80"}
        `}
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
  isExpanded: boolean;
}

function ConnectionItem({ mode, activeMode, onClick, icon, label, color, isExpanded }: ConnectionItemProps) {
  const isActive = activeMode === mode;

  return (
    <button
      onClick={onClick}
      className={`
        group flex items-center rounded-lg transition-all duration-200 border
        ${isExpanded ? "flex-row gap-3 px-3 py-2.5 justify-start" : "flex-col gap-1 p-2 justify-center"}
      `}
      style={{
        borderColor: isActive ? color : color.replace(')', ', 0.3)'), 
        backgroundColor: isActive ? color : 'transparent',
      }}
    >
      <div 
        className="transition-colors shrink-0"
        style={{ 
            color: isActive ? '#0B0F1A' : color 
        }} 
      >
         <span style={{ color: isActive ? '#111827' : color, fontWeight: 'bold' }}>
            {icon}
         </span>
      </div>
      
      <span 
        className={`font-medium transition-colors whitespace-nowrap overflow-hidden
          ${isExpanded ? "text-sm" : "text-[9px]"}
        `}
        style={{ color: isActive ? '#111827' : 'var(--color-text-muted)' }}
      >
        {label}
      </span>
    </button>
  );
}