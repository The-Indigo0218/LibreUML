import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface NameConflictModalProps {
  isOpen: boolean;
  diagramName: string;
  currentFileName: string;
  onSaveAsNew: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
}

export default function NameConflictModal({ 
  isOpen, 
  diagramName, 
  currentFileName, 
  onSaveAsNew, 
  onOverwrite, 
  onCancel 
}: NameConflictModalProps) {
  const { t } = useTranslation();
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="bg-surface-primary border border-surface-border p-6 rounded-xl shadow-2xl w-125 max-w-full m-4 transform scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-amber-500/10 rounded-full shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary mb-1">
              {t("alerts.nameConflictTitle") || "Conflicto de Nombre"}
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Has cambiado el nombre del diagrama a <strong className="text-text-primary">"{diagramName}"</strong>, 
              pero estás editando el archivo <strong className="text-text-primary">"{currentFileName}.luml"</strong>.
            </p>
            <p className="text-text-muted text-xs mt-2">
              ¿Qué te gustaría hacer?
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={onSaveAsNew}
            className="w-full flex items-center justify-between px-4 py-3 bg-uml-class-border text-white rounded-lg hover:brightness-110 transition-all shadow-md group"
          >
            <span className="font-medium text-sm">Guardar como "{diagramName}.luml"</span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded text-white group-hover:bg-white/30">Nuevo Archivo</span>
          </button>

          <button
            onClick={onOverwrite}
            className="w-full flex items-center justify-between px-4 py-3 bg-surface-secondary border border-surface-border text-text-primary rounded-lg hover:bg-surface-hover hover:border-text-muted transition-all"
          >
            <span className="font-medium text-sm">Sobrescribir "{currentFileName}.luml"</span>
            <span className="text-[10px] text-text-muted border border-surface-border px-2 py-0.5 rounded">Mantener Archivo</span>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-surface-border flex justify-center">
          <button
            onClick={onCancel}
            className="text-text-muted text-sm hover:text-text-primary underline decoration-dotted underline-offset-4"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}