import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { StickyNote } from "lucide-react";
import type { UmlClassData } from "../../../../../types/diagram.types";
import { useDiagramStore } from "../../../../../store/diagramStore";
import { handleConfig } from "../../../../../config/theme.config";

const UmlNoteNode = ({ id, data }: NodeProps<UmlClassData>) => {
  const updateNodeData = useDiagramStore((s) => s.updateNodeData);

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingContent, setEditingContent] = useState(false);

  const handleStyle = `${handleConfig.size} ${handleConfig.base} ${handleConfig.colors.note} opacity-0 group-hover:opacity-100`;
  return (
    <div className="bg-uml-note-bg border border-uml-note-border rounded-sm w-56 shadow-md overflow-visible relative group flex flex-col font-sans transition-colors">
      {/* Top */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className={handleStyle}
      />

      {/* Right */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={handleStyle}
      />

      {/* Bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={handleStyle}
      />

      {/* left */}
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className={handleStyle}
      />

      {/*Note  Header  */}
      <div
        className="bg-surface-secondary p-2 border-b border-dashed border-uml-note-border rounded-t-sm flex items-center justify-between"
        onDoubleClick={() => setEditingTitle(true)}
      >
        {editingTitle ? (
          <input
            autoFocus
            className="w-full bg-transparent font-bold text-sm text-uml-note-border outline-none placeholder-uml-note-border/50"
            value={data.label}
            onChange={(e) => updateNodeData(id, { label: e.target.value })}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
            placeholder="Título..."
          />
        ) : (
          <div className="font-bold text-sm text-uml-note-border truncate w-full pr-4">
            {data.label}
          </div>
        )}

        {!editingTitle && (
          <StickyNote className="w-3 h-3 text-uml-note-border shrink-0" />
        )}
      </div>

      {/* Note Content */}
      <div
        className="p-2 min-h-20 cursor-text"
        onClick={() => !editingContent && setEditingContent(true)}
      >
        {editingContent ? (
          <textarea
            autoFocus
            className="w-full h-full min-h-20 bg-transparent resize-none outline-none text-xs text-text-secondary leading-relaxed font-mono"
            value={data.content || ""}
            onChange={(e) => updateNodeData(id, { content: e.target.value })}
            onBlur={() => setEditingContent(false)}
            placeholder="Escribe aquí..."
          />
        ) : (
          <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-mono">
            {data.content || <span className="opacity-30 italic">...</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(UmlNoteNode);
