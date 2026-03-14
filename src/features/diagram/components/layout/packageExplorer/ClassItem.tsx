import { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, Hash, FunctionSquare, Settings } from "lucide-react";
import type { UmlAttribute, UmlMethod } from "../../../types/diagram.types";
import type { ClassItemProps } from "./types";

export function ClassItem({ 
  classNode, 
  level, 
  isExpanded, 
  isRenaming,
  onToggle, 
  onClassClick,
  onEditClass,
  onContextMenu,
  onRename,
  onCancelRename
}: ClassItemProps) {
  const hasMembers = classNode.data.attributes.length > 0 || classNode.data.methods.length > 0;
  const [editValue, setEditValue] = useState(classNode.data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleCommit = () => {
    if (editValue.trim() && editValue !== classNode.data.label) {
      onRename(classNode.id, editValue.trim());
    } else {
      onCancelRename();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditValue(classNode.data.label);
      onCancelRename();
    }
  };

  const getStereotypeIcon = (stereotype: string) => {
    switch (stereotype) {
      case "interface":
        return (
          <div className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center text-[10px] font-bold text-green-400">
            I
          </div>
        );
      case "abstract":
        return (
          <div className="w-4 h-4 rounded-full bg-purple-500/20 border border-purple-500 flex items-center justify-center text-[10px] font-bold text-purple-400">
            A
          </div>
        );
      case "enum":
        return (
          <div className="w-4 h-4 rounded-full bg-yellow-500/20 border border-yellow-500 flex items-center justify-center text-[10px] font-bold text-yellow-400">
            E
          </div>
        );
      default:
        return (
          <div className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center text-[10px] font-bold text-blue-400">
            C
          </div>
        );
    }
  };

  const getVisibilityColor = (visibility: string) => {
    switch (visibility) {
      case "+": return "text-green-400";
      case "-": return "text-red-400";
      case "#": return "text-yellow-400";
      case "~": return "text-blue-400";
      default: return "text-text-muted";
    }
  };

  return (
    <div>
      <div
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-hover rounded cursor-pointer group transition-colors"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onContextMenu={(e) => onContextMenu(e, classNode.id, classNode.data.label)}
      >
        {hasMembers ? (
          <button 
            className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(classNode.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}
        
        <div onClick={() => !isRenaming && onClassClick(classNode.id)} className="flex items-center gap-2 flex-1 min-w-0">
          {getStereotypeIcon(classNode.data.stereotype)}
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleCommit}
              className="flex-1 bg-surface-secondary text-sm text-text-primary outline-none px-1 py-0.5 rounded border border-uml-class-border"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-sm text-text-primary group-hover:text-uml-class-border truncate flex-1">
              {classNode.data.label}
            </span>
          )}
          {classNode.data.isMain && (
            <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded font-bold">
              MAIN
            </span>
          )}
        </div>

        {/* Edit Button - Only visible on hover */}
        {!isRenaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditClass(classNode.id);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-surface-secondary rounded text-text-muted hover:text-uml-class-border"
            title="Edit Properties"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isExpanded && (
        <div>
          {classNode.data.attributes.length > 0 && (
            <div>
              {classNode.data.attributes.map((attr: UmlAttribute) => (
                <div
                  key={attr.id}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-surface-hover/50 rounded transition-colors"
                  style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
                >
                  <div className="w-4" />
                  <Hash className="w-3 h-3 text-cyan-400" />
                  <span className={`text-[10px] font-mono ${getVisibilityColor(attr.visibility)}`}>
                    {attr.visibility}
                  </span>
                  <span className="text-xs text-text-secondary truncate">
                    {attr.name}: {attr.type}{attr.isArray ? "[]" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          {classNode.data.methods.length > 0 && (
            <div>
              {classNode.data.methods.map((method: UmlMethod) => (
                <div
                  key={method.id}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-surface-hover/50 rounded transition-colors"
                  style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
                >
                  <div className="w-4" />
                  <FunctionSquare className="w-3 h-3 text-purple-400" />
                  <span className={`text-[10px] font-mono ${getVisibilityColor(method.visibility)}`}>
                    {method.visibility}
                  </span>
                  <span className="text-xs text-text-secondary truncate">
                    {method.name}(): {method.returnType}{method.isReturnArray ? "[]" : ""}
                  </span>
                  {method.isStatic && (
                    <span className="text-[8px] text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded">
                      static
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
