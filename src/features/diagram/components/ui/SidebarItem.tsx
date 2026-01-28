import { type stereotype } from "../../types/diagram.types";

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
      className="flex items-center gap-3 p-2 rounded-md bg-surface-secondary border border-surface-border cursor-grab hover:bg-surface-hover hover:border-uml-class-border hover:shadow-md transition-all group"
      onDragStart={(event) => onDragStart(event, type)}
      draggable
    >
      <div className="p-1.5 bg-surface-primary rounded border border-surface-border group-hover:border-text-muted transition-colors">
        {icon}
      </div>
      <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
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
          ? "bg-surface-hover border-uml-class-border shadow-sm" // Activo: Usa el color primario de borde
          : "border-transparent hover:bg-surface-hover"          // Inactivo
      }`}
    >
      <div className={`p-1.5 rounded transition-colors ${isActive ? "text-uml-class-border" : "text-text-muted"}`}>
        {icon}
      </div>
      <span className={`text-sm transition-colors ${isActive ? "text-text-primary font-medium" : "text-text-secondary"}`}>
        {label}
      </span>
    </div>
  );
}