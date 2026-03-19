import { useEffect, useRef } from 'react';
import { Terminal, PanelBottomClose, ChevronRight, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLayoutStore } from '../../../../store/layout.store';
import { useTerminal } from '../../../../features/terminal/useTerminal';
import { useAutoLayout } from '../../hooks/useAutoLayout';
import { useModelValidation } from '../../hooks/useModelValidation';
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
    <div className={`leading-relaxed whitespace-pre-wrap break-all ${TYPE_CLASS[line.type]}`}>
      {line.content === '' ? '\u00A0' : line.content}
    </div>
  );
}

export default function BottomPanel() {
  const { t } = useTranslation();
  const { toggleBottomPanel, bottomPanelTab, setBottomPanelTab } = useLayoutStore();
  const { runLayout } = useAutoLayout();
  const { output, input, setInput, handleKeyDown, inputRef } = useTerminal({
    actions: { runLayout },
  });
  const { errors, errorCount } = useModelValidation();
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="h-full border-t border-[#1e2738] bg-[#0d1117] flex flex-col">

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="px-2 border-b border-[#1e2738] shrink-0 flex items-center justify-between select-none">
        <div className="flex items-center">
          <button
            onClick={() => setBottomPanelTab('terminal')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              bottomPanelTab === 'terminal'
                ? 'border-[#4ade80] text-[#e2e8f0]'
                : 'border-transparent text-[#64748b] hover:text-[#94a3b8]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            {t("terminal.tabs.terminal")}
          </button>

          <button
            onClick={() => setBottomPanelTab('problems')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              bottomPanelTab === 'problems'
                ? 'border-red-400 text-[#e2e8f0]'
                : 'border-transparent text-[#64748b] hover:text-[#94a3b8]'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            {t("terminal.tabs.problems")}
            {errorCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">
                {errorCount}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={toggleBottomPanel}
          className="p-1 rounded transition-colors hover:bg-[#1e2738] mr-1"
          title={t("projectStructure.closePanel")}
        >
          <PanelBottomClose className="w-3.5 h-3.5 text-[#64748b]" />
        </button>
      </div>

      {/* ── Terminal tab ─────────────────────────────────────────────── */}
      {bottomPanelTab === 'terminal' && (
        <>
          <div
            ref={outputRef}
            className="flex-1 px-4 py-3 font-mono text-xs overflow-y-auto custom-scrollbar cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            {output.map((line) => (
              <TerminalLine key={line.id} line={line} />
            ))}
          </div>

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
              placeholder={t("terminal.placeholder")}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        </>
      )}

      {/* ── Problems tab ─────────────────────────────────────────────── */}
      {bottomPanelTab === 'problems' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2">
          {errors.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs text-[#3d4f6b]">{t("terminal.noProblems")}</span>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {errors.map((msg, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 px-2 py-1.5 rounded hover:bg-[#1e2738] transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-[#cbd5e1] font-mono">{msg}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
