import { useMemo } from 'react';
import { XCircle, AlertTriangle, Info, Wrench, FileText, FolderTree } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProjectProblems, type Problem, type ProblemSeverity } from '../../hooks/useProjectProblems';
import { useWorkspaceStore } from '../../../../store/workspace.store';

const SEVERITY_ICON: Record<ProblemSeverity, typeof XCircle> = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_COLOR: Record<ProblemSeverity, string> = {
  error: 'text-red-400',
  warning: 'text-yellow-400',
  info: 'text-sky-400',
};

const PROJECT_GROUP = '__project__';

interface ProblemGroup {
  key: string;
  /** Diagram file id to open on click, or null for the project-wide group. */
  diagramId: string | null;
  title: string;
  problems: Problem[];
}

/**
 * Project-wide Problems panel (F1-B4).
 *
 * Renders the aggregated `useProjectProblems()` list grouped by diagram (plus a
 * project-wide bucket), with severity icons, navigation (click a row → open its
 * diagram tab) and inline quick-fixes (e.g. "Add to Project" for standalone files).
 * Lives inside the existing bottom panel's "Problems" tab.
 */
export default function ProblemsPanel() {
  const { t } = useTranslation();
  const { problems } = useProjectProblems();
  const openTab = useWorkspaceStore((s) => s.openTab);

  const groups = useMemo<ProblemGroup[]>(() => {
    const byDiagram = new Map<string, ProblemGroup>();
    for (const p of problems) {
      const key = p.diagramId ?? PROJECT_GROUP;
      let group = byDiagram.get(key);
      if (!group) {
        group = {
          key,
          diagramId: p.diagramId ?? null,
          title: p.diagramId ? (p.diagramName ?? p.diagramId) : 'Project',
          problems: [],
        };
        byDiagram.set(key, group);
      }
      group.problems.push(p);
    }
    // Project-wide group first, then diagrams alphabetically.
    return Array.from(byDiagram.values()).sort((a, b) => {
      if (a.diagramId === null) return -1;
      if (b.diagramId === null) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [problems]);

  if (problems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs text-[#3d4f6b]">{t('terminal.noProblems')}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-3">
      {groups.map((group) => (
        <div key={group.key}>
          <button
            type="button"
            disabled={group.diagramId === null}
            onClick={() => group.diagramId && openTab(group.diagramId)}
            className={`flex items-center gap-1.5 px-2 py-1 w-full text-left text-[11px] font-semibold uppercase tracking-wide ${
              group.diagramId
                ? 'text-[#94a3b8] hover:text-[#e2e8f0] cursor-pointer'
                : 'text-[#64748b] cursor-default'
            }`}
          >
            {group.diagramId ? (
              <FileText className="w-3 h-3 shrink-0" />
            ) : (
              <FolderTree className="w-3 h-3 shrink-0" />
            )}
            <span className="truncate">{group.title}</span>
            <span className="ml-1 text-[10px] font-mono text-text-muted/50 tabular-nums">
              {group.problems.length}
            </span>
          </button>

          <ul className="space-y-0.5 mt-0.5">
            {group.problems.map((p) => {
              const Icon = SEVERITY_ICON[p.severity];
              return (
                <li
                  key={p.id}
                  onClick={() => p.diagramId && openTab(p.diagramId)}
                  className={`flex items-start gap-2.5 px-2 py-1.5 rounded transition-colors group ${
                    p.diagramId ? 'hover:bg-[#1e2738] cursor-pointer' : ''
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${SEVERITY_COLOR[p.severity]}`} />
                  <span className="text-xs text-[#cbd5e1] flex-1 leading-relaxed">{p.message}</span>
                  {p.fix && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        p.fix!.run();
                      }}
                      className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors opacity-80 group-hover:opacity-100"
                    >
                      <Wrench className="w-3 h-3" />
                      {p.fix.label}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
