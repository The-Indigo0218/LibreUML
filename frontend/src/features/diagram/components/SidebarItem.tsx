import { type stereotype } from "../../../types/diagram.types";

interface DraggableItemProps {
  label: string;
  type: stereotype;
  icon: React.ReactNode;
  onDragStart: (event: React.DragEvent, nodeType: stereotype) => void;
}

interface StaticItemProps {
  label: string;
  icon: React.ReactNode;
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

export function StaticItem({ label, icon }: StaticItemProps) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-md border border-transparent hover:bg-slate-800/50 cursor-not-allowed transition-all">
      <div className="p-1.5 text-slate-500">{icon}</div>
      <span className="text-sm text-slate-500">{label}</span>
    </div>
  );
}