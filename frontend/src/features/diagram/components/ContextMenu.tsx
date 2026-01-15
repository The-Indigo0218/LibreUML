import { useEffect, useRef } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  options: {
    label: string;
    onClick: () => void;
    danger?: boolean; 
  }[];
  onClose: () => void;
}

export default function ContextMenu({
  x,
  y,
  options,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 min-w-45 bg-surface-primary border border-surface-border rounded-md shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col overflow-hidden"
      style={{ top: y, left: x }}
    >
      {options.map((option, index) => (
        <button
          key={index}
          onClick={() => {
            option.onClick();
            onClose();
          }}
          className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 border-l-2 border-transparent
            ${
              option.danger
                ? "text-red-400 hover:bg-red-900/20 hover:text-red-300 hover:border-red-500"
                : "text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-uml-class-border"
            }
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}