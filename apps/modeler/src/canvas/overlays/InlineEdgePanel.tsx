/**
 * InlineEdgePanel — docked contextual properties panel for the selected edge.
 *
 * The "big version" of the floating selection toolbar: instead of opening a
 * modal for the most frequent association edits (multiplicities + roles), this
 * panel docks to the top-right of the canvas and edits them live. Field commits
 * happen on blur / Enter (one undo per commit) so typing doesn't spam the undo
 * stack.
 *
 * Reserved for the multiplicity relation kinds (Association / Aggregation /
 * Composition); the full modal — relation-kind change, direction, anchor picker —
 * stays reachable via the "Advanced…" button for the complex / rarer cases.
 *
 * Mounted inside CanvasOverlay (pointer-events: none container) and opts back in.
 * The parent keys this component on edge id + persisted values, so an external
 * change (reverse, undo) remounts it with fresh state; local typing does not.
 */

import { useState } from 'react';
import { X, ArrowLeftRight, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDismissOnOutsideClick } from '../../hooks/useDismissOnOutsideClick';
import { isValidMultiplicity } from '../../core/domain/multiplicity.utils';
import MultiplicitySelector from '../../features/diagram/components/shared/MultiplicitySelector';

export interface InlineEdgePanelValues {
  sourceRole: string;
  targetRole: string;
  sourceMultiplicity: string;
  targetMultiplicity: string;
}

/** UML navigability of one association end. undefined = unspecified. */
export type Navigability = boolean | undefined;

export interface InlineEdgePanelProps {
  /** Edge id — used as React key by the parent so the panel re-inits per edge. */
  edgeId: string;
  /** Current persisted values for the edge. */
  values: InlineEdgePanelValues;
  /** Display names of the two endpoints. */
  sourceName: string;
  targetName: string;
  /** Current UML navigability of each end (undefined = unspecified). */
  sourceNavigable: Navigability;
  targetNavigable: Navigability;
  /** Persists a subset of edge props (called on field blur / commit). */
  onCommit: (props: Partial<InlineEdgePanelValues>) => void;
  /** Sets the navigability of one end (semantic — shared across diagrams). */
  onNavigableChange: (end: 'source' | 'target', value: Navigability) => void;
  /** Reverse the relation direction. */
  onReverse: () => void;
  /** Open the full modal editor (kind change, anchor picker). */
  onAdvanced: () => void;
  /** Close the panel. */
  onClose: () => void;
}

/**
 * NavigabilitySelector — 3-state segmented control for one association end.
 *   —  unspecified (default; no arrowhead, matches EA/StarUML)
 *   →  navigable (open arrow)
 *   ✕  not navigable
 */
function NavigabilitySelector({
  value,
  onChange,
  label,
}: {
  value: Navigability;
  onChange: (v: Navigability) => void;
  label: string;
}) {
  const opts: { key: string; v: Navigability; glyph: string; title: string }[] = [
    { key: 'u', v: undefined, glyph: '—', title: 'Sin especificar' },
    { key: 'n', v: true, glyph: '→', title: 'Navegable' },
    { key: 'x', v: false, glyph: '✕', title: 'No navegable' },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-text-secondary uppercase tracking-wider">{label}</span>
      <div className="flex rounded border border-surface-border overflow-hidden">
        {opts.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.key}
              type="button"
              title={o.title}
              onClick={() => onChange(o.v)}
              className={
                'px-2 py-0.5 text-xs font-mono transition-colors ' +
                (active
                  ? 'bg-indigo-500 text-white'
                  : 'bg-surface-secondary text-text-secondary hover:text-text-primary')
              }
            >
              {o.glyph}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function InlineEdgePanel({
  values,
  sourceName,
  targetName,
  sourceNavigable,
  targetNavigable,
  onCommit,
  onNavigableChange,
  onReverse,
  onAdvanced,
  onClose,
}: InlineEdgePanelProps) {
  const { t } = useTranslation();
  const dismissRef = useDismissOnOutsideClick<HTMLDivElement>(onClose);
  const [sourceRole, setSourceRole] = useState(values.sourceRole);
  const [targetRole, setTargetRole] = useState(values.targetRole);
  const [sourceMul, setSourceMul] = useState(values.sourceMultiplicity);
  const [targetMul, setTargetMul] = useState(values.targetMultiplicity);

  const srcMulValid = isValidMultiplicity(sourceMul);
  const tgtMulValid = isValidMultiplicity(targetMul);

  const commitRole = (which: 'sourceRole' | 'targetRole', v: string) => {
    if (v !== values[which]) onCommit({ [which]: v });
  };
  const commitMul = (which: 'sourceMultiplicity' | 'targetMultiplicity', v: string, valid: boolean) => {
    if (valid && v !== values[which]) onCommit({ [which]: v });
  };

  return (
    <div
      ref={dismissRef}
      className="absolute right-4 top-16 z-30 pointer-events-auto w-72
                 rounded-xl border border-surface-border bg-surface-primary/97 shadow-2xl backdrop-blur-sm
                 animate-in fade-in slide-in-from-right-2 duration-150"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          {t('inlineEdgePanel.title')}
        </span>
        <button
          onClick={onClose}
          title={t('inlineEdgePanel.close')}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Source end */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider truncate">
            ◄ {sourceName}
          </div>
          <input
            type="text"
            value={sourceRole}
            onChange={(e) => setSourceRole(e.target.value)}
            onBlur={() => commitRole('sourceRole', sourceRole)}
            onKeyDown={(e) => e.key === 'Enter' && commitRole('sourceRole', sourceRole)}
            placeholder={t('inlineEdgePanel.rolePlaceholder')}
            className="w-full bg-surface-secondary border border-surface-border rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-indigo-500 font-mono"
          />
          <MultiplicitySelector
            value={sourceMul}
            onChange={(v) => { setSourceMul(v); commitMul('sourceMultiplicity', v, isValidMultiplicity(v)); }}
            invalid={!srcMulValid}
            accent="indigo"
          />
          <NavigabilitySelector
            value={sourceNavigable}
            onChange={(v) => onNavigableChange('source', v)}
            label={t('inlineEdgePanel.navigability', 'Navegabilidad')}
          />
        </div>

        {/* Target end */}
        <div className="space-y-1.5 border-t border-surface-border/50 pt-3">
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider truncate">
            {targetName} ►
          </div>
          <input
            type="text"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            onBlur={() => commitRole('targetRole', targetRole)}
            onKeyDown={(e) => e.key === 'Enter' && commitRole('targetRole', targetRole)}
            placeholder={t('inlineEdgePanel.rolePlaceholder')}
            className="w-full bg-surface-secondary border border-surface-border rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-indigo-500 font-mono"
          />
          <MultiplicitySelector
            value={targetMul}
            onChange={(v) => { setTargetMul(v); commitMul('targetMultiplicity', v, isValidMultiplicity(v)); }}
            invalid={!tgtMulValid}
            accent="indigo"
          />
          <NavigabilitySelector
            value={targetNavigable}
            onChange={(v) => onNavigableChange('target', v)}
            label={t('inlineEdgePanel.navigability', 'Navegabilidad')}
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 border-t border-surface-border/50 pt-3">
          <button
            onClick={onReverse}
            title={t('inlineEdgePanel.reverse')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-surface-border bg-surface-secondary text-xs text-text-secondary hover:border-indigo-500 hover:text-indigo-400 transition-all"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {t('inlineEdgePanel.reverse')}
          </button>
          <button
            onClick={onAdvanced}
            title={t('inlineEdgePanel.advanced')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-surface-border bg-surface-secondary text-xs text-text-secondary hover:border-indigo-500 hover:text-indigo-400 transition-all ml-auto"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {t('inlineEdgePanel.advanced')}
          </button>
        </div>
      </div>
    </div>
  );
}
