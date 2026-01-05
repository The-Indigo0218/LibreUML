// src/features/diagram/components/Sidebar.tsx
import type { stereotype } from "../../../types/diagram.types";

export default function Sidebar() {
  
  const onDragStart = (event: React.DragEvent, nodeType: stereotype) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/reactflow', nodeType);
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col h-full text-white p-4 shadow-xl z-10">
      <h2 className="text-xl font-bold mb-4 text-slate-200">Toolbox</h2>
      <p className="text-xs text-slate-400 mb-6">Drag and drop components to the canvas.</p>

      <div className="flex flex-col gap-3">
        
        {/*  CLASS */}
        <div 
          className="p-3 bg-slate-800 border border-slate-600 rounded cursor-grab hover:bg-slate-700 hover:border-blue-500 transition-all flex items-center gap-2"
          onDragStart={(event) => onDragStart(event, 'class')}
          draggable
        >
          <div className="w-4 h-4 bg-yellow-100 border border-black rounded-sm"></div>
          <span>Class</span>
        </div>

        {/*  INTERFACE */}
        <div 
          className="p-3 bg-slate-800 border border-slate-600 rounded cursor-grab hover:bg-slate-700 hover:border-blue-500 transition-all flex items-center gap-2"
          onDragStart={(event) => onDragStart(event, 'interface')}
          draggable
        >
          <div className="w-4 h-4 bg-yellow-100 border border-black rounded-sm flex items-center justify-center text-[6px]">I</div>
          <span>Interface</span>
        </div>

        {/*  ABSTRACT */}
        <div 
          className="p-3 bg-slate-800 border border-slate-600 rounded cursor-grab hover:bg-slate-700 hover:border-blue-500 transition-all flex items-center gap-2"
          onDragStart={(event) => onDragStart(event, 'abstract')}
          draggable
        >
          <div className="w-4 h-4 bg-yellow-100 border border-black rounded-sm italic flex items-center justify-center text-[6px]">A</div>
          <span className="italic">Abstract</span>
        </div>
      </div>
    </aside>
  );
}