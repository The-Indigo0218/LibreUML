import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface MenubarSubMenuProps {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}

export function MenubarSubMenu({ label, icon, children, disabled = false }: MenubarSubMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  const closeTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (disabled) return;
    
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }
    
    timeoutRef.current = window.setTimeout(() => setIsOpen(true), 100);
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    
    closeTimeoutRef.current = window.setTimeout(() => setIsOpen(false), 300);
  };

  const handleSubmenuMouseEnter = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }
  };

  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-sm transition-colors select-none
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          ${disabled 
            ? "text-text-muted" 
            : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          }
        `}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}
          <span>{label}</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 ml-4" />
      </button>

      {isOpen && !disabled && (
        <div 
          className="absolute left-full top-0 ml-1 min-w-48 bg-surface-primary border border-surface-border rounded-md shadow-xl py-1 z-[70] animate-in fade-in slide-in-from-left-1 duration-100"
          onMouseEnter={handleSubmenuMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {children}
        </div>
      )}
    </div>
  );
}
