import { useState, useEffect, useMemo } from "react";
import { Copy, Check, FileCode, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDiagramStore } from "../../../../store/diagramStore";
import { useUiStore } from "../../../../store/uiStore";
import { JavaGeneratorService } from "../../../../services/javaGenerator.service";
import type { UmlClassNode } from "../../types/diagram.types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SingleClassGeneratorModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const nodes = useDiagramStore((s) => s.nodes);
  const editingId = useUiStore((s) => s.editingId); 
  
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [language, setLanguage] = useState("java"); // State for language
  const [generatedCode, setGeneratedCode] = useState("");
  const [copied, setCopied] = useState(false);

  //  Determine target class priority
  useEffect(() => {
    if (!isOpen) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setGeneratedCode("");
        setCopied(false);
        setLanguage("java"); 
        return;
    }

    let targetId = "";

    if (editingId) {
        targetId = editingId;
    } else {
        const selectedNodes = nodes.filter(n => n.selected && n.type === 'umlClass');
        if (selectedNodes.length === 1) {
            targetId = selectedNodes[0].id;
        } else if (nodes.length > 0) {
            const firstClass = nodes.find(n => n.type === 'umlClass');
            if (firstClass) targetId = firstClass.id;
        }
    }
    
    setSelectedClassId(targetId);
  }, [isOpen, editingId, nodes]);

  //  Generate Code logic
  useEffect(() => {
    if (!selectedClassId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setGeneratedCode("// " + t('modals.codePreview.noClassSelected', "No class selected"));
        return;
    }

    const node = nodes.find(n => n.id === selectedClassId) as UmlClassNode;
    if (node && node.type === 'umlClass') {
        if (language === 'java') {
            const code = JavaGeneratorService.generate(node);
            setGeneratedCode(code);
        } else {
            setGeneratedCode("// Coming soon...");
        }
    } else {
        setGeneratedCode("// " + t('modals.codePreview.invalidNode', "Selected node is not a valid Class/Interface"));
    }
  }, [selectedClassId, nodes, language, t]);

  const allClasses = useMemo(() => 
    nodes.filter(n => n.type === 'umlClass') as UmlClassNode[], 
  [nodes]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-150 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <FileCode className="w-5 h-5" />
            </div>
            <div>
                <h3 className="font-bold text-text-primary">{t('modals.codePreview.title', 'Code Preview')}</h3>
                <p className="text-xs text-text-muted">{t('modals.codePreview.subtitle', 'Generate code for a single class')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Selectors */}
        <div className="px-6 py-3 border-b border-surface-border bg-surface-secondary/30 flex items-center gap-4">
            
            {/* Language Selector */}
            <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase">
                    {t('modals.codePreview.languageLabel', 'Language:')}
                </label>
                <select 
                    className="bg-surface-secondary border border-surface-border rounded px-2 py-1 text-sm text-text-primary outline-none focus:border-blue-500"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                >
                    <option value="java">Java</option>
                    <option value="python" disabled>Python (Soon)</option>
                    <option value="csharp" disabled>C# (Soon)</option>
                    <option value="sql" disabled>SQL (Soon)</option>
                </select>
            </div>

            <div className="w-px h-4 bg-surface-border" />

            {/* Class Selector */}
            <div className="flex items-center gap-2 flex-1">
                <label className="text-xs font-bold text-text-secondary uppercase">
                    {t('modals.codePreview.classLabel', 'Class:')}
                </label>
                <select 
                    className="bg-surface-secondary border border-surface-border rounded px-2 py-1 text-sm text-text-primary outline-none focus:border-blue-500 w-full"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                >
                    {allClasses.map(node => (
                        <option key={node.id} value={node.id}>
                            {node.data.label} {node.data.stereotype !== 'class' ? `(${node.data.stereotype})` : ''}
                        </option>
                    ))}
                </select>
            </div>
        </div>

        {/* Code Viewer */}
        <div className="flex-1 overflow-auto p-0 bg-[#1e1e1e] custom-scrollbar group relative">
            <pre className="p-6 text-sm font-mono text-gray-300 leading-relaxed">
                {generatedCode}
            </pre>
            
            <button 
                onClick={handleCopy}
                className="absolute top-4 right-4 p-2 bg-surface-primary/10 border border-white/10 rounded hover:bg-white/10 text-white transition-all opacity-0 group-hover:opacity-100"
                title={t('modals.codePreview.copyTitle', "Copy to clipboard")}
            >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-border bg-surface-secondary/50 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
             {t('modals.codePreview.close', 'Close')}
          </button>
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 font-medium shadow-md active:scale-95 transition-all"
          >
            {copied ? (
               <>
                 <Check className="w-4 h-4" /> {t('modals.codePreview.copied', 'Copied!')}
               </>
            ) : (
               <>
                 <Copy className="w-4 h-4" /> {t('modals.codePreview.copy', 'Copy Code')}
               </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}