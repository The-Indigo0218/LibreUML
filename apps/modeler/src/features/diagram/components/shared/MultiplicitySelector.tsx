import { MULTIPLICITY_PRESETS } from '../../../../core/domain/multiplicity.utils';

interface Props {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  accent?: 'amber' | 'indigo';
}

export default function MultiplicitySelector({ value, onChange, invalid, accent = 'amber' }: Props) {
  const isAmber = accent === 'amber';

  const chipActive = isAmber
    ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]'
    : 'bg-indigo-900/40 border-indigo-500 text-indigo-300 font-bold';
  const chipIdle = isAmber
    ? 'border-[#2a3358] text-[#64748b] hover:border-[#3d4a6e] hover:text-[#94a3b8]'
    : 'bg-surface-primary border-surface-border text-text-secondary hover:border-indigo-400';
  const inputBase = isAmber
    ? 'w-full bg-[#0f1419] border rounded px-2.5 py-1 text-sm font-mono placeholder-[#374151] focus:outline-none transition-colors text-[#e2e8f0]'
    : 'w-full bg-surface-secondary border rounded px-2.5 py-1 text-sm font-mono outline-none transition-colors text-text-primary';
  const inputBorder = invalid && value
    ? 'border-red-500 focus:border-red-400'
    : isAmber
      ? 'border-[#2a3358] focus:border-[#f59e0b]'
      : 'border-surface-border focus:border-indigo-500';
  const clearCls = isAmber
    ? 'text-[10px] px-1.5 py-0.5 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10'
    : 'text-[10px] px-1.5 py-0.5 rounded border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors';

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {MULTIPLICITY_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(value === p ? '' : p)}
            className={[
              'px-2 py-0.5 rounded text-xs font-mono border transition-colors',
              value === p ? chipActive : chipIdle,
            ].join(' ')}
          >
            {p}
          </button>
        ))}
        {value && (
          <button type="button" onClick={() => onChange('')} className={clearCls}>
            ✕
          </button>
        )}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="custom (e.g. 2..5)"
        className={[inputBase, inputBorder].join(' ')}
      />
      {invalid && value && (
        <p className="text-[10px] text-red-400">Invalid multiplicity notation</p>
      )}
    </div>
  );
}
