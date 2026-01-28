interface DynamicListProps {
  label: string;
  items: string[];
  onItemChange: (index: number, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
}

export default function DynamicList({ label, items, onItemChange, onAddItem, onRemoveItem }: DynamicListProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-400 mb-1">{label}</label>
      {items.map((item, index) => (
        <div key={index} className="flex items-center mb-2">
          <input
            type="text"
            value={item}
            onChange={(e) => onItemChange(index, e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          />
          {item.trim() === "" && (
            <p className="text-red-500 text-xs mt-1">
              {label.slice(0, -1)} cannot be empty.
            </p>
          )}
          <button  onClick={() => onRemoveItem(index)} className="ml-2 text-red-500 hover:text-red-400">
            &times;
          </button>
        </div>
        
      ))}
      <button onClick={onAddItem} className="mt-2 px-3 py-1 text-sm bg-green-600 hover:bg-green-500 rounded font-medium transition-colors">
        + Add {label}
      </button>
    </div>
  );
}
