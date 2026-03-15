import { XCircle, AlertTriangle } from "lucide-react";
import { useWorkspaceStore } from "../../../store/workspace.store";
import { useTranslation } from "react-i18next";

export default function StatusBar() {
  const { t } = useTranslation();
  const getActiveFile = useWorkspaceStore((s) => s.getActiveFile);
  
  const activeFile = getActiveFile();

  // Placeholder diagnostic counts (future: connect to actual linter)
  const errorCount = 0;
  const warningCount = 0;

  if (!activeFile) return null;

  const getDiagramTypeLabel = (diagramType: string) => {
    switch (diagramType) {
      case "CLASS_DIAGRAM":
        return t("statusBar.diagramTypes.classDiagram");
      case "USE_CASE_DIAGRAM":
        return t("statusBar.diagramTypes.useCaseDiagram");
      default:
        return diagramType;
    }
  };

  const handleLanguageClick = () => {
    console.log("Modeling language selector clicked");
    // TODO: Open modeling language dropdown (Java, C#, Python, etc.)
  };

  return (
    <div className="h-6 w-full bg-[#007acc] text-white flex items-center justify-between px-3 text-xs select-none shrink-0 z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-medium">{activeFile.name}</span>
          <span className="text-white/60">•</span>
          <span className="text-white/80">{getDiagramTypeLabel(activeFile.diagramType)}</span>
        </div>

        {/* Diagnostics (Linter Placeholder) */}
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors"
            title={t("statusBar.errors")}
            onClick={() => console.log("Show errors")}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>{errorCount}</span>
          </button>

          <button
            className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors"
            title={t("statusBar.warnings")}
            onClick={() => console.log("Show warnings")}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{warningCount}</span>
          </button>
        </div>

        {activeFile.isDirty && (
          <div className="flex items-center gap-1.5 text-amber-300">
            <span>*</span>
            <span>{t("statusBar.unsaved")}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-white/70">
        <span>{t("statusBar.encoding")}</span>
        
        {/* Modeling Language Selector (Placeholder) */}
        <button
          onClick={handleLanguageClick}
          className="hover:bg-white/10 px-2 py-0.5 rounded transition-colors hover:text-white"
          title={t("statusBar.modelingLanguageTooltip")}
        >
          {t("statusBar.modelingLanguage")}
        </button>
        
        <span>React Flow</span>
      </div>
    </div>
  );
}
