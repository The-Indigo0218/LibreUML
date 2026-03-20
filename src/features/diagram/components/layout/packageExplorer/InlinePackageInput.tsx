import { useRef, useEffect, useState } from "react";

interface InlinePackageInputProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  placeholder?: string;
  level?: number;
  parentPath?: string;
}

export function InlinePackageInput({ 
  value, 
  onChange, 
  onCommit, 
  onCancel, 
  placeholder = "package.name",
  level = 0,
  parentPath
}: InlinePackageInputProps) {
  // TODO: SSOT Migration - Package validation needs WorkspaceStore integration
  const packages: Array<{ id: string; name: string }> = [];
  
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasError, setHasError] = useState(false);
  const [originalValue] = useState(value);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const validatePackageName = (name: string): boolean => {
    const fullPath = parentPath ? `${parentPath}.${name}` : name;
    return packages.some(pkg => pkg.name === fullPath);
  };

  const handleCommit = () => {
    if (value.trim() && validatePackageName(value.trim())) {
      setHasError(true);
      setTimeout(() => {
        onChange(originalValue);
        setHasError(false);
        onCancel();
      }, 2000);
    } else {
      onCommit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div 
      className={`px-2 py-1.5 bg-surface-secondary/50 rounded border mb-1 transition-colors ${
        hasError ? 'border-red-500' : 'border-uml-class-border'
      }`}
      style={{ marginLeft: `${level * 12 + 8}px` }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleCommit}
        placeholder={placeholder}
        className={`w-full bg-transparent text-sm outline-none placeholder:text-text-muted/50 transition-colors ${
          hasError ? 'text-red-500' : 'text-text-primary'
        }`}
      />
      {hasError && (
        <p className="text-xs text-red-500 mt-1">A package with this name already exists.</p>
      )}
    </div>
  );
}
