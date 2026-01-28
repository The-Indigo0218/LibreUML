import { Minus, Square, X } from "lucide-react";

export default function WindowControls() {
  if (!window.electronAPI?.isElectron()) return null;

  return (
    <div className="flex items-center h-full no-drag">
      {/* Minimize Button */}
      <button
        onClick={() => window.electronAPI?.minimize()}
        className="h-10 w-12 flex items-center justify-center text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        title="Minimize"
        tabIndex={-1}
      >
        <Minus className="w-4 h-4" />
      </button>

      {/* Maximize / Restore Button */}
      <button
        onClick={() => window.electronAPI?.toggleMaximize()}
        className="h-10 w-12 flex items-center justify-center text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        title="Maximizar"
        tabIndex={-1}
      >
        <Square className="w-3.5 h-3.5" />
      </button>

      {/* Close Bottom */}
      <button
        onClick={() => window.electronAPI?.close()}
        className="h-10 w-12 flex items-center justify-center text-text-secondary hover:bg-red-500 hover:text-white transition-colors"
        title="Cerrar"
        tabIndex={-1}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
