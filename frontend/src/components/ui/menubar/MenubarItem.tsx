import type { ReactNode } from "react";

interface MenubarItemProps {
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export function MenubarItem({
  label,
  icon,
  shortcut,
  onClick,
  disabled,
  danger
}: MenubarItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-sm transition-colors select-none
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${danger 
          ? "text-red-400 hover:bg-red-500/10" 
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        }
      `}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}
        <span>{label}</span>
      </div>
      
      {shortcut && (
        <span className="text-[10px] text-text-muted font-mono ml-4 opacity-70">
          {shortcut}
        </span>
      )}
    </button>
  );
}