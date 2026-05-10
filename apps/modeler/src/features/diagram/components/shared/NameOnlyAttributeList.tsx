import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

export interface NameOnlyAttr {
  id: string;
  name: string;
}

interface Props {
  attrs: NameOnlyAttr[];
  onChange: (attrs: NameOnlyAttr[]) => void;
}

export default function NameOnlyAttributeList({ attrs, onChange }: Props) {
  const add = () =>
    onChange([...attrs, { id: crypto.randomUUID(), name: '' }]);

  const remove = (id: string) =>
    onChange(attrs.filter((a) => a.id !== id));

  const move = (id: string, dir: -1 | 1) => {
    const idx = attrs.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= attrs.length) return;
    const arr = [...attrs];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    onChange(arr);
  };

  const updateName = (id: string, name: string) =>
    onChange(attrs.map((a) => (a.id === id ? { ...a, name } : a)));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
          Attributes
        </label>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-xs text-[#f59e0b] hover:text-[#fbbf24] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      <div className="space-y-1.5">
        {attrs.length === 0 && (
          <p className="text-xs text-[#475569] py-2 text-center">
            No attributes — click Add to define one
          </p>
        )}
        {attrs.map((attr, i) => (
          <div key={attr.id} className="flex items-center gap-1.5">
            <input
              value={attr.name}
              onChange={(e) => updateName(attr.id, e.target.value)}
              placeholder="attributeName"
              className="flex-1 bg-[#0f1419] border border-[#2a3358] rounded px-2 py-1 text-sm text-[#e2e8f0] placeholder-[#374151] focus:outline-none focus:border-[#f59e0b] transition-colors font-mono"
            />
            <button
              type="button"
              onClick={() => move(attr.id, -1)}
              disabled={i === 0}
              className="p-1 text-[#475569] hover:text-[#94a3b8] disabled:opacity-30 transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => move(attr.id, 1)}
              disabled={i === attrs.length - 1}
              className="p-1 text-[#475569] hover:text-[#94a3b8] disabled:opacity-30 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => remove(attr.id)}
              className="p-1 text-[#475569] hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
