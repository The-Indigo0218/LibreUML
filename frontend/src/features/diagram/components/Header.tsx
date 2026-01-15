import { useRef, useState, useEffect } from "react";
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
  ChevronDown,
  FileJson,
  Image as ImageIcon,
  Cloud,
} from "lucide-react";
import { useDiagramStore } from "../../../store/diagramStore";
import { ExportService } from "../services/export.service"; 

export default function Header() {
  const { zoomIn, zoomOut, fitView, toObject, setViewport, getNodes } = useReactFlow();
  
  const { 
    diagramName, 
    diagramId, 
    setDiagramName, 
    loadDiagram, 
    showMiniMap, 
    toggleMiniMap 
  } = useDiagramStore();
  
  const [isDarkMode, setIsDarkMode] = useState(true); 
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExportJson = () => {
    const flowObject = toObject();
    ExportService.downloadJson(flowObject, diagramId, diagramName);
    setIsExportMenuOpen(false);
  };

  const handleExportImage = async () => {
    const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewportEl) return;

    try {
      const nodes = getNodes();
      await ExportService.downloadPng(viewportEl, nodes, diagramName);
    } catch (error) {
      console.error('Error exportando imagen:', error);
      alert("No se pudo generar la imagen. Intenta de nuevo.");
    }
    setIsExportMenuOpen(false);
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
        
        if (parsedData.viewport) {
          const { x, y, zoom } = parsedData.viewport;
          setViewport({ x, y, zoom });
        } else {
          setTimeout(() => fitView({ duration: 800 }), 100);
        }

      } catch (error) {
        console.error("Error loading file:", error);
        alert("Error al leer el archivo. Asegúrate de que sea un .json o .luml válido.");
      }
    };
    reader.readAsText(file);
    event.target.value = ""; 
  };

  return (
    <header className="h-14 bg-surface-primary border-b border-surface-border flex items-center justify-between px-4 z-20 relative shadow-md font-sans">
      
      {/* SECCIÓN IZQUIERDA: Logo y Título */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 font-bold text-lg select-none">
          <Box className="w-6 h-6 text-uml-class-border fill-uml-class-bg/20" />
          <span className="text-text-primary tracking-tight">LibreUML</span>
        </div>

        <div className="h-5 w-px bg-surface-border mx-2" />

        <input
          type="text"
          value={diagramName}
          onChange={(e) => setDiagramName(e.target.value)}
          className="text-sm font-medium bg-surface-secondary text-text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-white focus:outline-none focus:ring-1 focus:ring-uml-class-border rounded px-2 py-1 transition-all w-48 truncate border border-transparent"
          placeholder="Diagram Name"
        />
      </div>

      {/* SECCIÓN CENTRAL: Toolbar */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-surface-secondary p-1 rounded-lg border border-surface-border shadow-lg">
        <IconButton onClick={() => {}} icon={<Undo className="w-4 h-4" />} tooltip="Undo" disabled />
        <IconButton onClick={() => {}} icon={<Redo className="w-4 h-4" />} tooltip="Redo" disabled />
        <div className="w-px h-4 bg-surface-border mx-1" />
        <IconButton
          onClick={toggleMiniMap}
          icon={<Map className={`w-4 h-4 transition-colors ${showMiniMap ? "text-uml-class-border fill-uml-class-bg" : ""}`} />}
          tooltip={showMiniMap ? "Hide MiniMap" : "Show MiniMap"}
        />
        <div className="w-px h-4 bg-surface-border mx-1" />
        <IconButton onClick={() => zoomOut()} icon={<ZoomOut className="w-4 h-4" />} tooltip="Zoom Out" />
        <IconButton onClick={() => fitView({ duration: 800 })} icon={<Maximize className="w-4 h-4" />} tooltip="Fit View" />
        <IconButton onClick={() => zoomIn()} icon={<ZoomIn className="w-4 h-4" />} tooltip="Zoom In" />
      </div>

      {/* SECCIÓN DERECHA: Acciones */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 mr-2">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors">
            {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors">
            <Languages className="w-4 h-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-surface-border mx-1" />

        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json,.luml" className="hidden" />

        <button onClick={handleImportClick} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors border border-transparent hover:border-surface-border">
          <FolderOpen className="w-4 h-4" /> Import
        </button>

        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors border rounded-md 
              ${isExportMenuOpen 
                ? "bg-surface-hover text-text-primary border-surface-border" 
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover border-transparent hover:border-surface-border"
              }`}
          >
            <Download className="w-4 h-4" />
            Export
            <ChevronDown className={`w-3 h-3 transition-transform ${isExportMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {/* DROPDOWN */}
          {isExportMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-surface-primary border border-surface-border rounded-md shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
              
              <button onClick={handleExportJson} className="flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover text-left transition-colors">
                <FileJson className="w-4 h-4 text-uml-class-border" />
                <span>Save as .luml</span>
              </button>

              <button onClick={handleExportImage} className="flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover text-left transition-colors">
                <ImageIcon className="w-4 h-4 text-purple-400" />
                <span>Export to PNG</span>
              </button>

              <div className="h-px bg-surface-border my-1 mx-2" />

              <button disabled className="flex items-center gap-3 px-4 py-2 text-sm text-text-muted cursor-not-allowed opacity-50 text-left">
                <Cloud className="w-4 h-4" />
                <span>Save to Cloud</span>
                <span className="ml-auto text-[10px] bg-surface-secondary px-1.5 py-0.5 rounded border border-surface-border uppercase tracking-wider font-bold">Soon</span>
              </button>
            </div>
          )}
        </div>

        <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-uml-class-border hover:brightness-110 rounded-md transition-all shadow-sm active:translate-y-px ml-2">
          <Save className="w-4 h-4" /> Save
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
      className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:shadow-sm rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      title={tooltip}
    >
      {icon}
    </button>
  );
}