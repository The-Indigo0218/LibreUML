import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Play } from "lucide-react";
import type { NodeViewModel } from "../../../../../adapters/react-flow/view-models/node.view-model";
import { useProjectStore } from "../../../../../store/project.store";
import { handleConfig } from "../../../../../config/theme.config";

/**
 * UmlClassNode - Generic node renderer for Class Diagram nodes
 * 
 * PHASE 2: This component now receives a generic NodeViewModel instead of domain types.
 * It has ZERO knowledge of domain models (ClassNode, InterfaceNode, etc.).
 * All rendering is based on the generic sections array.
 */
const UmlClassNode = ({ data, selected }: NodeProps<NodeViewModel>) => {
  const updateNode = useProjectStore((s) => s.updateNode);
  const viewModel = data;
  
  const [isEditing, setIsEditing] = useState(() => viewModel.label === "NewClass");
  const [editValue, setEditValue] = useState("");

  const startEditing = () => {
    const fullText = viewModel.sublabel
      ? `${viewModel.label}${viewModel.sublabel}`
      : viewModel.label;
    setEditValue(fullText);
    setIsEditing(true);
  };

  const commitChanges = () => {
    setIsEditing(false);

    const match = editValue.match(/^([^<]+)(<.*>)?$/);

    if (match) {
      const cleanLabel = match[1].trim();
      const cleanGeneric = match[2] ? match[2].trim() : undefined;

      updateNode(viewModel.domainId, {
        name: cleanLabel,
        generics: cleanGeneric,
      });
    } else {
      updateNode(viewModel.domainId, { name: editValue });
    }
  };

  const currentStyle = viewModel.style;
  const isMain = viewModel.metadata?.isMain;

  const selectionClasses = selected
    ? "ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] !border-cyan-500 z-10"
    : "hover:shadow-md";

  return (
    <div
      className={`border-2 rounded-sm min-w-[16rem] max-w-lg w-fit overflow-visible group transition-all duration-200 ${currentStyle.containerClass} ${selectionClasses}`}
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
        className={`p-2 border-b-2 text-center cursor-pointer hover:brightness-110 transition-all ${currentStyle.headerClass} ${selected ? "border-cyan-500/30!" : ""}`}
        onDoubleClick={startEditing}
      >
        {isMain && (
          <div className="absolute top-1 right-1" title="Entry Point (Main)">
            <div className="bg-green-500 text-white rounded-full p-0.5 shadow-sm animate-in zoom-in duration-300">
              <Play className="w-3 h-3 fill-current" />
            </div>
          </div>
        )}

        {(currentStyle.showStereotype || viewModel.badge) && (
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            {currentStyle.showStereotype && viewModel.stereotype && (
              <small
                className={`text-[10px] leading-tight font-mono ${
                  currentStyle.labelFormat.includes("italic") ? "italic" : ""
                } ${currentStyle.badgeColor}`}
              >
                &lt;&lt;{viewModel.stereotype}&gt;&gt;
              </small>
            )}
            
            {viewModel.badge && (
              <small className="text-[10px] leading-tight font-mono text-text-muted truncate max-w-30" title={viewModel.badge}>
                {viewModel.badge}
              </small>
            )}
          </div>
        )}

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
            {viewModel.label}
            {viewModel.sublabel && (
              <span className="text-yellow-600 font-mono ml-0.5 text-xs opacity-90">
                {viewModel.sublabel}
              </span>
            )}
          </strong>
        )}
      </div>

      {/* SECTIONS (Generic Rendering) */}
      {viewModel.sections.map((section, sectionIndex) => {
        const isLastSection = sectionIndex === viewModel.sections.length - 1;
        
        return (
          <div
            key={section.id}
            className={`p-2 ${!isLastSection ? 'border-b-2' : ''} min-h-6 text-xs text-left font-mono text-text-secondary ${
              selected
                ? "border-cyan-500/30!"
                : currentStyle.containerClass
                    .split(" ")
                    .find((c) => c.startsWith("border-")) 
            }`}
          >
            {section.items.length > 0 ? (
              section.items.map((item) => (
                <div
                  key={item.id}
                  className={`hover:text-text-primary transition-colors py-0.5 leading-relaxed ${
                    item.isStatic ? 'underline' : ''
                  } ${item.isAbstract ? 'italic' : ''}`}
                >
                  {item.text}
                </div>
              ))
            ) : (
              <div className="h-2"></div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default memo(UmlClassNode);
