import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { StickyNote } from "lucide-react";
import type { UmlClassData } from "../../../../types/diagram.types";
import { useDiagramStore } from "../../../../store/diagramStore";

const UmlNoteNode = ({ id, data }: NodeProps<UmlClassData>) => {
  const updateNodeData = useDiagramStore((s) => s.updateNodeData);
  
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingContent, setEditingContent] = useState(false);

  const handleStyle = "w-3 h-3 !bg-yellow-500 border border-white opacity-0 group-hover:opacity-100 transition-opacity";

  return (
    <div className="bg-yellow-50 border border-yellow-400 rounded-sm w-56 shadow-md overflow-visible relative group flex flex-col font-sans">
      
      <Handle type="source" position={Position.Bottom} className={handleStyle} />
      <Handle type="source" position={Position.Top} className={handleStyle} />
      <Handle type="source" position={Position.Left} className={handleStyle} />
      <Handle type="source" position={Position.Right} className={handleStyle} />

      <div 
        className="bg-yellow-200 p-2 border-b border-yellow-300 rounded-t-sm flex items-center justify-between"
        onDoubleClick={() => setEditingTitle(true)}
      >
        {editingTitle ? (
           <input
             autoFocus
             className="w-full bg-transparent font-bold text-sm text-yellow-900 outline-none placeholder-yellow-700/50"
             value={data.label}
             onChange={(e) => updateNodeData(id, { label: e.target.value })}
             onBlur={() => setEditingTitle(false)}
             onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
             placeholder="Título..."
           />
        ) : (
           <div className="font-bold text-sm text-yellow-900 truncate w-full pr-4">
             {data.label}
           </div>
        )}
        
        {!editingTitle && <StickyNote className="w-3 h-3 text-yellow-600 shrink-0" />}
      </div>

      <div 
        className="p-2 min-h-20 cursor-text"
        onClick={() => !editingContent && setEditingContent(true)}
      >
        {editingContent ? (
          <textarea
            autoFocus
            className="w-full h-full min-h-20 bg-transparent resize-none outline-none text-xs text-slate-700 leading-relaxed font-mono"
            value={data.content || ""}
            onChange={(e) => updateNodeData(id, { content: e.target.value })}
            onBlur={() => setEditingContent(false)}
            placeholder="Detalles de la nota..."
          />
        ) : (
          <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">
             {data.content || <span className="opacity-40 italic">Clic para escribir...</span>}
          </div>
        )}
      </div>

    </div>
  );
};

export default memo(UmlNoteNode);