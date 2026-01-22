import { useState, useRef, useEffect, type ReactNode } from "react";

interface MenubarTriggerProps {
  label: string;
  children: ReactNode; 
}

export function MenubarTrigger({ label, children }: MenubarTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative no-drag" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          px-3 py-1 text-xs rounded transition-colors select-none
          ${isOpen 
            ? "bg-surface-hover text-text-primary" 
            : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          }
        `}
      >
        {label}
      </button>

      {isOpen && (
        <div 
          className="absolute top-full left-0 mt-1 min-w-50 bg-surface-primary border border-surface-border rounded-md shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-75"
          onClick={() => setIsOpen(false)} 
        >
          {children}
        </div>
      )}
    </div>
  );
}