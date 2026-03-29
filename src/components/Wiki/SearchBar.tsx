import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 300);
  };

  const handleClear = () => {
    setLocal("");
    onChange("");
  };

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3 w-4 h-4 text-text-muted pointer-events-none" />
      <input
        type="text"
        value={local}
        onChange={handleChange}
        placeholder={t("wiki.search_placeholder")}
        className="w-full pl-9 pr-8 py-2 bg-surface-secondary border border-surface-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/60 transition-colors"
        autoComplete="off"
        spellCheck={false}
      />
      {local && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 p-0.5 text-text-muted hover:text-text-primary transition-colors rounded"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
