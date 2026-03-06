import { useRef, useEffect } from "react";

interface InlinePackageInputProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  placeholder?: string;
  level?: number;
}

export function InlinePackageInput({ 
  value, 
  onChange, 
  onCommit, 
  onCancel, 
  placeholder = "package.name",
  level = 0
}: InlinePackageInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div 
      className="px-2 py-1.5 bg-surface-secondary/50 rounded border border-uml-class-border mb-1"
      style={{ marginLeft: `${level * 12 + 8}px` }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onCancel}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted/50"
      />
    </div>
  );
}
