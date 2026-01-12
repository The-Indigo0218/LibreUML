import { useState } from "react";
import { useReactFlow } from "reactflow";
import { 
  Box, 
  Download, 
  Save, 
  Undo, 
  Redo, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
  Moon,
//  Sun
} from "lucide-react";

export default function Header() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [fileName, setFileName] = useState("Untitled Diagram");

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20 relative shadow-sm">
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-blue-600 font-bold text-lg select-none">
          <Box className="w-6 h-6 fill-blue-100" />
          <span>LibreUML</span>
        </div>
        
        <div className="h-6 w-px bg-slate-300 mx-2" />
        
        <input 
          type="text" 
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          className="text-sm font-medium text-slate-700 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 rounded px-2 py-1 transition-all w-48 truncate"
        />
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
        <IconButton onClick={() => {}} icon={<Undo className="w-4 h-4" />} tooltip="Undo" disabled />
        <IconButton onClick={() => {}} icon={<Redo className="w-4 h-4" />} tooltip="Redo" disabled />
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <IconButton onClick={() => zoomOut()} icon={<ZoomOut className="w-4 h-4" />} tooltip="Zoom Out" />
        <IconButton onClick={() => fitView({ duration: 800 })} icon={<Maximize className="w-4 h-4" />} tooltip="Fit View" />
        <IconButton onClick={() => zoomIn()} icon={<ZoomIn className="w-4 h-4" />} tooltip="Zoom In" />
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors mr-2">
            <Moon className="w-4 h-4" />
        </button>

        <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors border border-transparent hover:border-slate-200">
          <Download className="w-4 h-4" />
          Export
        </button>
        
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors shadow-sm">
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>
    </header>
  );
}

interface IconButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  tooltip?: string;
  disabled?: boolean;
}

function IconButton({ icon, onClick, disabled }: IconButtonProps) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 text-slate-600 hover:bg-white hover:shadow-sm rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {icon}
    </button>
  );
}