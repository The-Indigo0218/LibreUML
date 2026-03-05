import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Play } from "lucide-react";
import type { UmlClassData } from "../../../types/diagram.types";
import { useDiagramStore } from "../../../../../store/diagramStore";
import { handleConfig } from "../../../../../config/theme.config";

const STYLE_CONFIG: Record<
  string,
  {
    container: string;
    header: string;
    badgeColor: string;
    labelFormat: string;
    showStereotype: boolean;
  }
> = {
  interface: {
    container: "bg-uml-interface-bg border-uml-interface-border",
    header: "bg-surface-secondary border-uml-interface-border",
    badgeColor: "text-uml-interface-border",
    labelFormat: "font-normal",
    showStereotype: true,
  },
  abstract: {
    container: "bg-uml-abstract-bg border-uml-abstract-border",
    header: "bg-surface-hover border-uml-abstract-border",
    badgeColor: "text-uml-abstract-border",
    labelFormat: "italic font-bold",
    showStereotype: true,
  },
  enum: {
    container:
      "bg-purple-100 dark:bg-purple-900/20 border-purple-400 dark:border-purple-500",
    header:
      "bg-purple-200 dark:bg-purple-900/50 border-purple-400 dark:border-purple-500",
    badgeColor: "text-purple-700 dark:text-purple-300",
    labelFormat: "font-bold",
    showStereotype: true,
  },
  class: {
    container: "bg-uml-class-bg border-uml-class-border",
    header: "bg-surface-hover border-uml-class-border",
    badgeColor: "text-uml-class-border",
    labelFormat: "font-bold",
    showStereotype: false,
  },
};

const UmlClassNode = ({ id, data, selected }: NodeProps<UmlClassData>) => {
  const updateNodeData = useDiagramStore((s) => s.updateNodeData);
  const [isEditing, setIsEditing] = useState(() => data.label === "NewClass");
  const [editValue, setEditValue] = useState("");

  const startEditing = () => {
    const fullText = data.generics
      ? `${data.label}${data.generics}`
      : data.label;
    setEditValue(fullText);
    setIsEditing(true);
  };

  const commitChanges = () => {
    setIsEditing(false);

    const match = editValue.match(/^([^<]+)(<.*>)?$/);

    if (match) {
      const cleanLabel = match[1].trim();
      const cleanGeneric = match[2] ? match[2].trim() : undefined;

      updateNodeData(id, {
        label: cleanLabel,
        generics: cleanGeneric,
      });
    } else {
      updateNodeData(id, { label: editValue });
    }
  };

  const isMain = data.isMain;

  const currentStyle = STYLE_CONFIG[data.stereotype] || STYLE_CONFIG.class;

  const selectionClasses = selected
    ? "ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] !border-cyan-500 z-10"
    : "hover:shadow-md";

  return (
    <div
      className={`border-2 rounded-sm min-w-[16rem] max-w-lg w-fit overflow-visible group transition-all duration-200 ${currentStyle.container} ${selectionClasses}`}
    >
      {/* Target Handles (Green) */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={`${handleConfig.size} ${handleConfig.base} ${handleConfig.colors.target} opacity-0 group-hover:opacity-100`}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={`${handleConfig.size} ${handleConfig.base} ${handleConfig.colors.target} opacity-0 group-hover:opacity-100`}
      />

      {/* Source Handles (Blue) */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={`${handleConfig.size} ${handleConfig.base} ${handleConfig.colors.source} opacity-0 group-hover:opacity-100`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={`${handleConfig.size} ${handleConfig.base} ${handleConfig.colors.source} opacity-0 group-hover:opacity-100`}
      />

      {/* HEADER */}
      <div
        className={`p-2 border-b-2 text-center cursor-pointer hover:brightness-110 transition-all ${currentStyle.header} ${selected ? "border-cyan-500/30!" : ""}`}
        onDoubleClick={startEditing}
      >
        {isMain && (
          <div className="absolute top-1 right-1" title="Entry Point (Main)">
            <div className="bg-green-500 text-white rounded-full p-0.5 shadow-sm animate-in zoom-in duration-300">
              <Play className="w-3 h-3 fill-current" />
            </div>
          </div>
        )}

        {/* Stereotype Label (e.g. <<interface>>) */}
        {currentStyle.showStereotype && (
          <small
            className={`block text-[10px] leading-tight mb-0.5 font-mono ${currentStyle.labelFormat.includes("italic") ? "italic" : ""} ${currentStyle.badgeColor}`}
          >
            &lt;&lt;{data.stereotype}&gt;&gt;
          </small>
        )}

        {/* Class Name */}
        {isEditing ? (
          <input
            autoFocus
            className={`w-full text-center text-sm bg-transparent border border-blue-500/50 rounded outline-none text-text-primary px-1 ${currentStyle.labelFormat}`}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitChanges}
            onKeyDown={(e) => e.key === "Enter" && commitChanges()}
          />
        ) : (
          <strong
            className={`text-sm block text-text-primary ${currentStyle.labelFormat}`}
          >
            {data.label}
            {data.generics && (
              <span className="text-yellow-600 font-mono ml-0.5 text-xs opacity-90">
                {data.generics}
              </span>
            )}
          </strong>
        )}
      </div>

      {/* BODY: Attributes */}
      <div
        className={`p-2 border-b-2 min-h-6 text-xs text-left font-mono text-text-secondary ${
          selected
            ? "border-cyan-500/30!"
            : currentStyle.container
                .split(" ")
                .find((c) => c.startsWith("border-")) 
        }`}
      >
        {data.attributes && data.attributes.length > 0 ? (
          data.attributes.map((attr) => (
            <div
              key={attr.id}
              className="truncate hover:text-text-primary transition-colors flex items-center gap-1"
            >
              <span className={`font-bold ${currentStyle.badgeColor}`}>
                {attr.visibility}
              </span>
              <span className="text-text-primary">{attr.name}</span>
              <span className="text-text-muted">:</span>
              <span className="text-uml-interface-border">
                {attr.type}
                {attr.isArray ? "[]" : ""}
              </span>
            </div>
          ))
        ) : (
          <div className="h-2"></div>
        )}
      </div>

     {/* FOOTER: Methods */}
      <div className="p-2 min-h-6 text-xs text-left font-mono text-text-secondary">
        {data.methods && data.methods.length > 0 ? (
          data.methods.map((method, index) => {
            const params = method.parameters || [];
            
            const paramChunks = [];
            for (let i = 0; i < params.length; i += 3) {
              paramChunks.push(params.slice(i, i + 3));
            }

            return (
              <div
                key={method.id || `${method.name}-${index}`}
                className="hover:text-text-primary transition-colors py-0.5 leading-relaxed wrap-break-word"
              >
                <div className="flex items-start">
                  <div className="shrink-0 flex items-center">
                    <span className={`font-bold mr-1 ${currentStyle.badgeColor}`}>
                      {method.visibility}
                    </span>
                    
                    {method.isConstructor && (
                      <span className="text-purple-400 text-[10px] mr-1 italic font-normal tracking-tight">
                        &lt;&lt;create&gt;&gt;
                      </span>
                    )}

                    <span
                      className={`text-text-primary ${method.isStatic ? "underline" : ""} ${
                        (data.stereotype === "interface" || data.stereotype === "abstract") &&
                        method.visibility !== "-"
                          ? "italic"
                          : ""
                      }`}
                    >
                      {method.isConstructor ? data.label : method.name}
                    </span>
                    <span className="text-text-muted">(</span>
                  </div>

                  {params.length === 0 ? (
                    method.isConstructor ? (
                      <span className="text-text-muted">)</span>
                    ) : (
                      <>
                        <span className="text-text-muted">): </span>
                        <span className="text-uml-interface-border">
                          {method.returnType}
                          {method.isReturnArray ? "[]" : ""}
                        </span>
                      </>
                    )
                  ) : (
                    <div className="flex flex-col flex-1 min-w-0">
                      {paramChunks.map((chunk, chunkIdx) => (
                        <div key={chunkIdx} className="flex flex-wrap">
                          {chunk.map((param, pIdx) => {
                            const isLastOverall =
                              chunkIdx === paramChunks.length - 1 &&
                              pIdx === chunk.length - 1;

                            return (
                              <span key={pIdx} className="text-uml-interface-border">
                                {param.name}: {param.type}{param.isArray ? "[]" : ""}
                                {!isLastOverall && <span className="mr-1.5">,</span>}
                              </span>
                            );
                          })}
                          
                          {chunkIdx === paramChunks.length - 1 && (
                            method.isConstructor ? (
                              <span className="text-text-muted">)</span>
                            ) : (
                              <>
                                <span className="text-text-muted">): </span>
                                <span className="text-uml-interface-border ml-1">
                                  {method.returnType}
                                  {method.isReturnArray ? "[]" : ""}
                                </span>
                              </>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-2"></div>
        )}
      </div>
    </div>
  );
};

export default memo(UmlClassNode);