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
  }, [data.label]);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { label: e.target.value });
  };

  const isInterface = data.stereotype === "interface";
  const isAbstract = data.stereotype === "abstract";

  let containerClass = "bg-uml-class-bg border-uml-class-border";
  let headerClass = "bg-surface-hover border-uml-class-border";
  let badgeColor = "text-uml-class-border";

  if (isInterface) {
    containerClass = "bg-uml-interface-bg border-uml-interface-border";
    headerClass = "bg-surface-secondary border-uml-interface-border"; 
    badgeColor = "text-uml-interface-border";
  } else if (isAbstract) {
    containerClass = "bg-uml-abstract-bg border-uml-abstract-border";
    headerClass = "bg-surface-hover border-uml-abstract-border";
    badgeColor = "text-uml-abstract-border";
  }

  return (
    <div 
      className={`border-2 rounded-sm w-64 shadow-lg overflow-visible group transition-colors duration-200 ${containerClass}`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-green-500 border border-canvas-base -top-1.5" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-blue-500 border border-canvas-base -right-1.5" />
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-green-500 border border-canvas-base -left-1.5" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-blue-500 border border-canvas-base -bottom-1.5" />

      {/* HEADER */}
      <div
        className={`p-2 border-b-2 text-center cursor-pointer hover:brightness-110 transition-all ${headerClass}`}
        onDoubleClick={() => setIsEditing(true)}
      >
        {isInterface && (
          <small className={`block text-[10px] leading-tight mb-0.5 font-mono ${badgeColor}`}>
            &lt;&lt;interface&gt;&gt;
          </small>
        )}
        
        {isAbstract && (
          <small className={`block text-[10px] leading-tight mb-0.5 font-mono italic ${badgeColor}`}>
            &lt;&lt;abstract&gt;&gt;
          </small>
        )}

        {isEditing ? (
          <input
            autoFocus
            className="w-full text-center font-bold text-sm bg-transparent border border-blue-500/50 rounded outline-none text-text-primary px-1"
            value={data.label}
            onChange={handleLabelChange}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setIsEditing(false)}
          />
        ) : (
          <strong className={`text-sm block text-text-primary ${isAbstract ? "italic" : ""}`}>
            {data.label}
          </strong>
        )}
      </div>

      {/* BODY: Attributes */}
      <div className={`p-2 border-b-2 min-h-6 text-xs text-left font-mono text-text-secondary ${isInterface ? "border-uml-interface-border" : isAbstract ? "border-uml-abstract-border" : "border-uml-class-border"}`}>
        {data.attributes && data.attributes.length > 0 ? (
          data.attributes.map((attr) => (
            <div key={attr.id} className="truncate hover:text-text-primary transition-colors flex items-center gap-1">
              <span className="text-uml-abstract-border font-bold">{attr.visibility}</span>
              <span className="text-text-primary">{attr.name}</span>
              <span className="text-text-muted">:</span>
              <span className="text-uml-interface-border">
                {attr.type}{attr.isArray ? '[]' : ''}
              </span>
            </div>
          ))
        ) : (
          <div className="h-2"></div> 
        )}
      </div>

      {/* FOOTER: Methods */}
      <div className="p-2 min-h-[24px] text-xs text-left font-mono text-text-secondary">
        {data.methods && data.methods.length > 0 ? (
          data.methods.map((method, index) => (
            <div key={method.id || `${method.name}-${index}`} className="truncate hover:text-text-primary transition-colors">
              <span className="text-uml-abstract-border font-bold">{method.visibility}</span>
              <span className="text-text-primary">{method.name}</span>
              <span className="text-text-muted">(</span>
              
              {(method.parameters || []).map((param, idx) => (
                <span key={idx} className="text-uml-interface-border">
                  {param.name}: {param.type}{idx < (method.parameters?.length || 0) - 1 ? ', ' : ''}
                </span>
              ))}
              
              <span className="text-text-muted">): </span>
              <span className="text-uml-interface-border">{method.returnType}</span>
            </div>
          ))
        ) : (
          <div className="h-2"></div>
        )}
      </div>
    </div>
  );
};

export default memo(UmlClassNode);