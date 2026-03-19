import { Terminal, PanelBottomClose } from "lucide-react";
import { useLayoutStore } from "../../../../store/layout.store";

export default function BottomTerminal() {
  const { toggleBottomPanel } = useLayoutStore();

  return (
    <div className="h-48 border-t border-surface-border bg-[#0d1117] flex flex-col">
      {/* Title bar */}
      <div
        className="px-4 py-2 border-b border-[#1e2738] shrink-0 flex items-center justify-between select-none cursor-default group"
        onDoubleClick={toggleBottomPanel}
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#64748b]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
            Terminal
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleBottomPanel(); }}
          className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100 hover:bg-[#1e2738]"
          title="Close Panel"
        >
          <PanelBottomClose className="w-3.5 h-3.5 text-[#64748b]" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-3 font-mono overflow-y-auto">
        <p className="text-sm text-[#4ade80] mb-2">
          &gt;_ Terminal{" "}
          <span className="text-[#334155]">(Coming Soon)</span>
        </p>
        <p className="text-xs text-[#334155] leading-relaxed">
          Available commands will include:{" "}
          <span className="text-[#475569]">
            /errors, /warnings, login, cloud, cd...
          </span>
        </p>
      </div>
    </div>
  );
}
