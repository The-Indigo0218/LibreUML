import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { type UmlClassData } from '../../../types/diagram.types';

/**
 * UmlClassNode Component
 * * Represents a standard UML Class box in the visual editor.
 * It consumes the "UmlClassData" contract we defined earlier.
 */
const UmlClassNode = ({ data }: NodeProps<UmlClassData>) => {
  return (
    <div className="bg-white border-2 border-black rounded-sm min-w-37.5 shadow-md">

      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-black!" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-black!" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-black!" />
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-black!" />

      {/* HEADER: Stereotype & Class Name */}
      <div className="bg-yellow-100 p-2 border-b-2 border-black text-center">
        {data.stereotype && (
          <small className="text-gray-600 block italic text-xs">
            {data.stereotype}
          </small>
        )}
        <strong className="font-bold text-sm block">
          {data.label}
        </strong>
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