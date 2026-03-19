import { useEffect, useRef } from 'react';
import { Terminal, PanelBottomClose, ChevronRight } from 'lucide-react';
import { useLayoutStore } from '../../../../store/layout.store';
import { useTerminal } from '../../../../features/terminal/useTerminal';
import { useAutoLayout } from '../../hooks/useAutoLayout';
import type { OutputLine } from '../../../../features/terminal/registry';

const TYPE_CLASS: Record<OutputLine['type'], string> = {
  output:  'text-[#cbd5e1]',
  error:   'text-[#f87171]',
  success: 'text-[#4ade80]',
  info:    'text-[#7dd3fc]',
  input:   'text-[#4a5568]',
  warn:    'text-[#fbbf24]',
};

function TerminalLine({ line }: { line: OutputLine }) {
  if (line.type === 'input') {
    const cmd = line.content.startsWith('libreuml~$ ')
      ? line.content.slice('libreuml~$ '.length)
      : line.content;
    return (
      <div className="leading-relaxed whitespace-pre-wrap break-all">
        <span className="text-[#4ade80] select-none">libreuml~$ </span>
        <span className="text-[#94a3b8]">{cmd}</span>
      </div>
    );
  }

  return (
    <div
      className={`leading-relaxed whitespace-pre-wrap break-all ${TYPE_CLASS[line.type]}`}
    >
      {line.content === '' ? '\u00A0' : line.content}
    </div>
  );
}

export default function BottomTerminal() {
  const { toggleBottomPanel } = useLayoutStore();
  const { runLayout } = useAutoLayout();
  const { output, input, setInput, handleKeyDown, inputRef } = useTerminal({
    actions: { runLayout },
  });
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="h-full border-t border-[#1e2738] bg-[#0d1117] flex flex-col">

      {/* ── Title bar ──────────────────────────────────────────────── */}
      <div
        className="px-4 py-1.5 border-b border-[#1e2738] shrink-0 flex items-center justify-between select-none cursor-default group"
        onDoubleClick={toggleBottomPanel}
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#4ade80]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
            Terminal
          </span>
          <span className="text-[#1e2738] text-xs mx-0.5">│</span>
          <span className="text-[10px] font-mono text-[#334155]">
            libreuml v1.0
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleBottomPanel();
          }}
          className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100 hover:bg-[#1e2738]"
          title="Close Panel"
        >
          <PanelBottomClose className="w-3.5 h-3.5 text-[#64748b]" />
        </button>
      </div>

      {/* ── Output area ────────────────────────────────────────────── */}
      <div
        ref={outputRef}
        className="flex-1 px-4 py-3 font-mono text-xs overflow-y-auto custom-scrollbar cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {output.map((line) => (
          <TerminalLine key={line.id} line={line} />
        ))}
      </div>

      {/* ── Input row ──────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center px-4 py-2 border-t border-[#151d2e] gap-2 bg-[#0a0e17]">
        <ChevronRight className="w-3 h-3 text-[#4ade80] shrink-0" />
        <span className="text-[#4ade80] font-mono text-xs select-none shrink-0">
          libreuml~$
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-[#e2e8f0] font-mono text-xs outline-none caret-[#4ade80] placeholder-[#2d3f5c]"
          placeholder="type a command…"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  );
}
