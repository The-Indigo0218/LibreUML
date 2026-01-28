import { useState, useRef } from "react";
import type { ChangeEvent } from "react"; 
import { Upload, FileText, Code, AlertCircle, X } from "lucide-react";
import { useDiagramStore } from "../../../../store/diagramStore";
import { ReverseEngineeringService } from "../../../../services/reverseEngineering.service";
import { useTranslation } from "react-i18next";
// Import types for casting
import type {
  UmlClassNode,
  UmlEdge,
  UmlClassData,
} from "../../types/diagram.types";
import type { Node, Edge } from "reactflow";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = "upload" | "paste";

export default function ImportCodeModal({ isOpen, onClose }: Props) {

  const {t} = useTranslation();

  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const [code, setCode] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Stores
  const { nodes, edges, setNodes, setEdges } = useDiagramStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // --- Handlers ---

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const readFile = (file: File) => {
    if (!file.name.endsWith(".java")) {
      setError("Please upload a valid .java file");
      return;
    }
    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCode(content);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!code.trim()) {
      setError("No code to import");
      return;
    }

    setIsProcessing(true);
    try {
      const result = ReverseEngineeringService.process(
        code,
        nodes as unknown as UmlClassNode[],
        edges as unknown as UmlEdge[],
      );

      setNodes(result.nodes as unknown as Node<UmlClassData>[]);
      setEdges(result.edges as unknown as Edge[]);

      onClose();
      // Reset state
      setCode("");
      setFileName(null);
    } catch (err) {
      console.error(err);
      setError("Failed to parse Java code. Check syntax.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-150 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border bg-surface-secondary/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-text-primary">{t("modals.importCode.title")}</h3>
              <p className="text-xs text-text-muted">
                {t("modals.importCode.subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-border">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === "upload" ? "bg-surface-primary text-green-400 border-b-2 border-green-400" : "bg-surface-secondary/30 text-text-secondary hover:text-text-primary"}`}
          >
            <FileText className="w-4 h-4" /> {t("modals.importCode.tabUpload")}
          </button>
          <button
            onClick={() => setActiveTab("paste")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === "paste" ? "bg-surface-primary text-green-400 border-b-2 border-green-400" : "bg-surface-secondary/30 text-text-secondary hover:text-text-primary"}`}
          >
            <Code className="w-4 h-4" /> {t("modals.importCode.tabPaste")}
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === "upload" ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-surface-border hover:border-green-500/50 rounded-xl p-10 flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer bg-surface-secondary/10 group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".java"
                onChange={handleFileChange}
              />

              {fileName ? (
                <>
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center text-green-400">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="text-text-primary font-medium">{fileName}</p>
                    <p className="text-sm text-green-400">{t("modals.importCode.ready")}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-surface-secondary rounded-full flex items-center justify-center text-text-muted group-hover:text-text-primary transition-colors">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-text-primary font-medium">
                      {t("modals.importCode.dragDropTitle")}
                    </p>
                    <p className="text-xs text-text-muted">
                      {t("modals.importCode.dragDropSubtitle")}
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col gap-2">
              <textarea
                className="w-full h-75 bg-surface-secondary border border-surface-border rounded-lg p-4 font-mono text-xs text-text-primary outline-none focus:border-green-500/50 resize-none"
                placeholder={t("modals.importCode.placeholder") || "Paste your Java code here..."}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-border bg-surface-secondary/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            {t("modals.common.cancel")}
          </button>
          <button
            onClick={handleImport}
            disabled={!code || isProcessing}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-500 font-medium shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              t("modals.importCode.analyzing")
            ) : (
              <>
                <Upload className="w-4 h-4" /> {t("modals.importCode.importBtn")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
