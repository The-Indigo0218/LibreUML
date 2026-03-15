import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface MenubarSubMenuProps {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}

/**
 * PHASE 9.6.1: Enhanced MenubarSubMenu with recursive nesting support
 * 
 * Features:
 * - Supports infinite nesting depth
 * - Smooth hover transitions with diagonal mouse movement tolerance
 * - Proper z-index stacking for deep menus
 * - Disabled state support
 */
export function MenubarSubMenu({ label, icon, children, disabled = false }: MenubarSubMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const closeTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (disabled) return;
    
    // Clear any pending close timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = undefined;
    }
    
    // Clear any pending open timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Open with slight delay for smooth UX
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 100);
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    
    // Clear any pending open timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    
    // Close with longer delay to allow diagonal mouse movement
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300);
  };

  const handleSubmenuMouseEnter = () => {
    // Keep submenu open when hovering over it
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = undefined;
    }
  };

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-sm transition-colors select-none ${
          disabled
            ? "text-text-muted cursor-not-allowed opacity-50"
            : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        }`}
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}
          <span>{label}</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
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
