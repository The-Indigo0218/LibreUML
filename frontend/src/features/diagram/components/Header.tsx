import { useRef, useState } from "react";
import { useReactFlow } from "reactflow";
import {
  Box,
  Download,
  Save,
  FolderOpen,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize,
  Moon,
  Languages,
  Sun,
  Map,
} from "lucide-react";
import { useDiagramStore } from "../../../store/diagramStore";

export default function Header() {
  const { zoomIn, zoomOut, fitView, toObject } = useReactFlow();
  const { loadDiagram, showMiniMap, toggleMiniMap } = useDiagramStore();
  const [fileName, setFileName] = useState("Untitled Diagram");
  const [isDarkMode, setIsDarkMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = toObject();
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.luml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        loadDiagram(parsedData);
        setFileName(file.name.replace(".luml", "").replace(".json", ""));
      } catch (error) {
        console.error("Error loading file:", error);
        alert("Error al leer el archivo.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20 relative shadow-sm font-sans">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-blue-600 font-bold text-lg select-none">
          <Box className="w-6 h-6 fill-blue-100" />
          <span className="text-slate-800 tracking-tight">LibreUML</span>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-2" />

        <input
          type="text"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          className="text-sm font-medium text-slate-600 hover:bg-slate-50 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 rounded px-2 py-1 transition-all w-48 truncate border border-transparent focus:border-blue-200"
        />
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <IconButton
          onClick={() => {}}
          icon={<Undo className="w-4 h-4" />}
          tooltip="Undo"
          disabled
        />
        <IconButton
          onClick={() => {}}
          icon={<Redo className="w-4 h-4" />}
          tooltip="Redo"
          disabled
        />
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <IconButton
          onClick={toggleMiniMap}
          icon={
            <Map
              className={`w-4 h-4 ${
                showMiniMap ? "text-blue-600 fill-blue-100" : ""
              }`}
            />
          }
          tooltip={showMiniMap ? "Hide MiniMap" : "Show MiniMap"}
        />
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <IconButton
          onClick={() => zoomOut()}
          icon={<ZoomOut className="w-4 h-4" />}
          tooltip="Zoom Out"
        />
        <IconButton
          onClick={() => fitView({ duration: 800 })}
          icon={<Maximize className="w-4 h-4" />}
          tooltip="Fit View"
        />
        <IconButton
          onClick={() => zoomIn()}
          icon={<ZoomIn className="w-4 h-4" />}
          tooltip="Zoom In"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 mr-2">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title="Toggle Theme"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <button
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title="Change Language"
          >
            <Languages className="w-4 h-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json,.luml"
          className="hidden"
        />

        <button
          onClick={handleImportClick}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors border border-transparent hover:border-slate-200"
        >
          <FolderOpen className="w-4 h-4" />
          Import
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors border border-transparent hover:border-slate-200"
        >
          <Download className="w-4 h-4" />
          Export
        </button>

        <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-all shadow-sm active:translate-y-px ml-2">
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

function IconButton({ icon, onClick, disabled, tooltip }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      title={tooltip}
    >
      {icon}
    </button>
  );
}
