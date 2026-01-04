import { memo, useState, useEffect } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { UmlClassData } from "../../../../types/diagram.types";
import { useDiagramStore } from "../../../../store/diagramStore";

const UmlClassNode = ({ id, data }: NodeProps<UmlClassData>) => {
  const updateNodeData = useDiagramStore((s) => s.updateNodeData);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (data.label === "NewClass") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsEditing(true);
    }
  }, []);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { label: e.target.value });
  };

  const isInterface = data.stereotype === "interface";
  const isAbstract = data.stereotype === "abstract";

  return (
    <div className="bg-white border-2 border-black rounded-sm w-64 shadow-md overflow-hidden">
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-black!"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-black!"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-black!"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 bg-black!"
      />

      {/* HEADER: Label */}
      <div
        className="bg-yellow-100 p-2 border-b-2 border-black text-center cursor-pointer"
        onDoubleClick={() => setIsEditing(true)}
      >
        {isInterface && (
          <small className="block text-[10px] leading-tight mb-0.5 text-slate-700">
            &lt;&lt;interface&gt;&gt;
          </small>
        )}
        
        {isAbstract && (
          <small className="block text-[10px] leading-tight mb-0.5 text-slate-700 italic">
            &lt;&lt;abstract&gt;&gt;
          </small>
        )}

        {isEditing ? (
          <input
            autoFocus
            className="w-full text-center font-bold text-sm bg-transparent border-none outline-none"
            value={data.label}
            onChange={handleLabelChange}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setIsEditing(false)}
          />
        ) : (
          <strong className="font-bold text-sm block">{data.label}</strong>
        )}
      </div>

      {/* BODY: Attributes */}
      <div className="p-2 border-b-2 border-black bg-white text-xs text-left font-mono">
        {data.attributes.length > 0 ? (
          data.attributes.map((attr, index) => (
            <div key={`${attr}-${index}`} className="truncate">
              {attr}
            </div>
          ))
        ) : (
          <div className="text-gray-400 italic">No attributes</div>
        )}
      </div>

      {/* FOOTER: Methods */}
      <div className="p-2 bg-white text-xs text-left font-mono">
        {data.methods.length > 0 ? (
          data.methods.map((method, index) => (
            <div key={`${method}-${index}`} className="truncate">
              {method}
            </div>
          ))
        ) : (
          <div className="text-gray-400 italic">No methods</div>
        )}
      </div>
    </div>
  );
};

// Optimization: 'memo' prevents re-rendering if props haven't changed.
export default memo(UmlClassNode);
