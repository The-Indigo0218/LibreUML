import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { ClassItem } from "./ClassItem";

interface UnassignedClassesProps {
  nodes: any[];
  onClassClick: (nodeId: string) => void;
  isDark: boolean;
  t: any;
}

export function UnassignedClasses({ nodes, onClassClick, isDark, t }: UnassignedClassesProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (nodes.length === 0) return null;

  return (
    <div className={`border-b ${isDark ? 'border-[#2d2d2d]' : 'border-[#e0e0e0]'}`}>
      <div className={`flex items-center gap-2 px-3 py-2 ${isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#e8e8e8]'}`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-0.5 rounded ${isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#d0d0d0]'}`}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <span className={`text-sm font-medium ${isDark ? 'text-[#858585]' : 'text-[#9e9e9e]'}`}>
          {t("sidebar.unassigned")}
        </span>
        <span className={`text-xs ${isDark ? 'text-[#6e6e6e]' : 'text-[#b0b0b0]'}`}>
          ({nodes.length})
        </span>
      </div>

      {isExpanded && (
        <div className="pl-6">
          {nodes.map((node) => (
            <ClassItem key={node.id} node={node} onClassClick={onClassClick} isDark={isDark} />
          ))}
        </div>
      )}
    </div>
  );
}
