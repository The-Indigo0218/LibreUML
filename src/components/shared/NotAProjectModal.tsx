import { FileQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";

interface NotAProjectModalProps {
  isOpen: boolean;
  fileName: string;
  onCreateProject: () => void;
  onCancel: () => void;
}

export default function NotAProjectModal({
  isOpen,
  fileName,
  onCreateProject,
  onCancel,
}: NotAProjectModalProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-primary border border-surface-border p-6 rounded-xl shadow-2xl w-96 max-w-full m-4 transform scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4 text-blue-400">
          <div className="p-2 bg-blue-400/10 rounded-full">
            <FileQuestion className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-text-primary">
            {t('modals.notAProject.title')}
          </h3>
        </div>
        
        <p className="text-text-secondary text-sm mb-2 leading-relaxed">
          {t('modals.notAProject.message')}
        </p>
        
        <p className="text-text-primary text-sm mb-6 font-medium">
          {fileName}
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors"
          >
            {t('modals.common.cancel')}
          </button>
          <button
            onClick={onCreateProject}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md shadow-lg shadow-blue-500/20 transition-all"
          >
            {t('modals.notAProject.createProject')}
          </button>
        </div>
      </div>
    </div>
  );
}
