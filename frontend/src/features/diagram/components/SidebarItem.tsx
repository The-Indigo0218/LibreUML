import { type stereotype } from "../../../types/diagram.types";

interface DraggableItemProps {
  label: string;
  type: stereotype;
  icon: React.ReactNode;
  onDragStart: (event: React.DragEvent, nodeType: stereotype) => void;
}

interface ClickableItemProps {
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  onClick: () => void;
}



export function DraggableItem({ label, type, icon, onDragStart }: DraggableItemProps) {
  return (
    <div
      className="flex items-center gap-3 p-2 rounded-md bg-slate-800 border border-slate-700 cursor-grab hover:bg-slate-700 hover:border-blue-500 hover:shadow-md transition-all group"
      onDragStart={(event) => onDragStart(event, type)}
      draggable
    >
      <div className="p-1.5 bg-slate-900 rounded border border-slate-700 group-hover:border-slate-500">
        {icon}
      </div>
      <span className="text-sm font-medium text-slate-300 group-hover:text-white">
        {label}
      </span>
    </div>
  );
}

export function ClickableItem({ label, icon, isActive, onClick }: ClickableItemProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-all ${
        isActive
          ? "bg-blue-900/40 border-blue-500 shadow-sm" // Estilo ACTIVO
          : "border-transparent hover:bg-slate-800"    // Estilo INACTIVO
      }`}
    >
      <div className={`p-1.5 rounded ${isActive ? "text-blue-400" : "text-slate-500"}`}>
        {icon}
      </div>
      <span className={`text-sm ${isActive ? "text-white font-medium" : "text-slate-500"}`}>
        {label}
      </span>
    </div>
  );
}