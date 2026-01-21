import { AlertTriangle, Save, Trash2, X } from "lucide-react";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  fileName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export default function UnsavedChangesModal({
  isOpen,
  fileName,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesModalProps) {
   
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="bg-surface-primary border border-surface-border p-6 rounded-xl shadow-2xl w-112.5 max-w-full m-4 transform scale-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-amber-500/10 rounded-full shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary mb-1">
              ¿Guardar cambios?
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Tienes cambios sin guardar en <strong className="text-text-primary">"{fileName}"</strong>.
            </p>
            <p className="text-text-muted text-xs mt-1">
              Si descartas, perderás los cambios recientes.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={onSave}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-uml-class-border text-white rounded-lg hover:brightness-110 transition-all shadow-md font-medium"
          >
            <Save className="w-4 h-4" /> Guardar
          </button>

          <button
            onClick={onDiscard}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all font-medium"
          >
            <Trash2 className="w-4 h-4" /> Descartar cambios
          </button>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-surface-border flex justify-center">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 text-text-muted text-sm hover:text-text-primary transition-colors"
          >
            <X className="w-3 h-3" /> Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}