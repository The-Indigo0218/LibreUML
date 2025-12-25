import { memo } from 'react';

interface MenuOption {
  label: string;
  onClick: () => void;
  icon?: string; 
  danger?: boolean; 
}

interface ContextMenuProps {
  x: number;
  y: number;
  options: MenuOption[];
  onClose: () => void;
}

const ContextMenu = ({ x, y, options, onClose }: ContextMenuProps) => {
  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose} 
        onContextMenu={(e) => { e.preventDefault(); onClose(); }} 
      />

      <div
        className="fixed z-50 min-w-40 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 overflow-hidden"
        style={{ top: y, left: x }}
      >
        {options.map((opt, index) => (
          <button
            key={index}
            onClick={() => {
              opt.onClick();
              onClose();
            }}
            className={`
              w-full px-4 py-2 text-left text-sm transition-colors
              ${opt.danger 
                ? 'text-red-400 hover:bg-red-500/10' 
                : 'text-slate-200 hover:bg-blue-600 hover:text-white'}
            `}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
};

export default memo(ContextMenu);