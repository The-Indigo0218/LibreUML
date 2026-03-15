import { useState } from "react";
import { X, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "../../store/workspace.store";
import type { DiagramType } from "../../core/domain/workspace/diagram-file.types";

interface CreateDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateDiagramModal({ isOpen, onClose }: CreateDiagramModalProps) {
  const { t } = useTranslation();
  const createNewFile = useWorkspaceStore((s) => s.createNewFile);
  const addFile = useWorkspaceStore((s) => s.addFile);

  const [name, setName] = useState("Untitled Diagram");
  const [diagramType, setDiagramType] = useState<DiagramType>("CLASS_DIAGRAM");
  const [modelingLanguage, setModelingLanguage] = useState("UML_DEFAULT");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newFile = createNewFile(diagramType, name);
    addFile(newFile);
    
    // Reset form and close
    setName("Untitled Diagram");
    setDiagramType("CLASS_DIAGRAM");
    setModelingLanguage("UML_DEFAULT");
    onClose();
  };

  const handleCancel = () => {
    // Reset form and close
    setName("Untitled Diagram");
    setDiagramType("CLASS_DIAGRAM");
    setModelingLanguage("UML_DEFAULT");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-surface-primary border border-surface-border rounded-lg shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">
              {t("modals.createDiagram.title")}
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-surface-hover rounded transition-colors text-text-muted hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">
              {t("modals.createDiagram.name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-surface-secondary border border-surface-border rounded text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("modals.createDiagram.namePlaceholder")}
              autoFocus
            />
          </div>

          {/* Diagram Type Select */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">
              {t("modals.createDiagram.diagramType")}
            </label>
            <select
              value={diagramType}
              onChange={(e) => setDiagramType(e.target.value as DiagramType)}
              className="w-full px-3 py-2 bg-surface-secondary border border-surface-border rounded text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="CLASS_DIAGRAM">{t("modals.createDiagram.types.classDiagram")}</option>
              <option value="USE_CASE_DIAGRAM">{t("modals.createDiagram.types.useCaseDiagram")}</option>
              <option value="OBJECT_DIAGRAM" disabled>{t("modals.createDiagram.types.objectDiagram")} (Coming Soon)</option>
            </select>
          </div>

          {/* Modeling Language Select */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">
              {t("modals.createDiagram.modelingLanguage")}
              <span className="ml-2 text-xs text-text-muted italic">
                ({t("modals.createDiagram.futureFeature")})
              </span>
            </label>
            <select
              value={modelingLanguage}
              onChange={(e) => setModelingLanguage(e.target.value)}
              className="w-full px-3 py-2 bg-surface-secondary border border-surface-border rounded text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="UML_DEFAULT">{t("modals.createDiagram.languages.umlDefault")}</option>
              <option value="JAVA">{t("modals.createDiagram.languages.java")}</option>
              <option value="CSHARP">{t("modals.createDiagram.languages.csharp")}</option>
              <option value="TYPESCRIPT">{t("modals.createDiagram.languages.typescript")}</option>
              <option value="PYTHON">{t("modals.createDiagram.languages.python")}</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded transition-colors"
            >
              {t("modals.common.cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors font-medium"
            >
              {t("modals.createDiagram.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
