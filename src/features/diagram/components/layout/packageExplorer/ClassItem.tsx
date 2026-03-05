import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { stereotype } from "../../../types/diagram.types";
import { ClassIcon } from "./ClassIcon";
import type { ClassItemProps } from "./types";

export function ClassItem({ node, onClassClick, isDark }: ClassItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const stereotype = node.data.stereotype as stereotype;
  const hasMembers = (node.data.attributes?.length > 0) || (node.data.methods?.length > 0);

  return (
    <div className={`border-b ${isDark ? 'border-[#2d2d2d]/50' : 'border-[#e0e0e0]/50'}`}>
      <div className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer ${isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#e8e8e8]'}`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-0.5 rounded ${isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#d0d0d0]'}`}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <ClassIcon stereotype={stereotype} />
        <span className="text-sm flex-1" onClick={() => onClassClick(node.id)}>
          {node.data.label}
        </span>
      </div>

      {isExpanded && (
        <div className={`pl-10 pb-2 text-xs ${isDark ? 'text-[#9e9e9e]' : 'text-[#757575]'}`}>
          {node.data.attributes?.length > 0 && (
            <div className="mb-2">
              <div className={`font-semibold text-[10px] uppercase tracking-wider mb-1 ${isDark ? 'text-[#858585]' : 'text-[#9e9e9e]'}`}>
                Atributos
              </div>
              {node.data.attributes.map((attr: any, idx: number) => (
                <div key={idx} className="py-0.5 font-mono">
                  {attr.visibility} {attr.name}: {attr.type}{attr.isArray ? '[]' : ''}
                </div>
              ))}
            </div>
          )}

          {node.data.methods?.length > 0 && (
            <div>
              <div className={`font-semibold text-[10px] uppercase tracking-wider mb-1 ${isDark ? 'text-[#858585]' : 'text-[#9e9e9e]'}`}>
                Métodos
              </div>
              {node.data.methods.map((method: any, idx: number) => (
                <div key={idx} className="py-0.5 font-mono">
                  {method.visibility} {method.name}(): {method.returnType}
                </div>
              ))}
            </div>
          )}

          {!hasMembers && (
            <div className={`italic ${isDark ? 'text-[#6e6e6e]' : 'text-[#b0b0b0]'}`}>
              Sin miembros
            </div>
          )}
        </div>
      )}
    </div>
  );
}
