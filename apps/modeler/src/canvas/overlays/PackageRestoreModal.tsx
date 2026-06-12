import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface PackageRestoreModalProps {
  elementName: string;
  packagePath: string;
  onNest: () => void;
  onFree: () => void;
  onCancel: () => void;
}

/**
 * Shown when a class/interface/enum is dropped from the Model Explorer but its
 * package is not on the canvas (R4). Offers to recreate the package and nest the
 * element, or place it free.
 */
export default function PackageRestoreModal({
  elementName,
  packagePath,
  onNest,
  onFree,
  onCancel,
}: PackageRestoreModalProps) {
  const { t } = useTranslation();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-text-primary mb-2">
          {t('modals.packageRestore.title')}
        </h2>

        <p className="text-sm text-text-secondary mb-5">
          {t('modals.packageRestore.description', { element: elementName, packagePath })}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onNest}
            className="w-full text-left px-4 py-3 rounded-lg border border-surface-border bg-surface-secondary hover:bg-surface-hover transition-colors"
          >
            <div className="text-sm font-medium text-text-primary mb-0.5">
              {t('modals.packageRestore.nestTitle', { packagePath })}
            </div>
            <div className="text-xs text-text-secondary">
              {t('modals.packageRestore.nestDesc')}
            </div>
          </button>

          <button
            onClick={onFree}
            className="w-full text-left px-4 py-3 rounded-lg border border-surface-border bg-surface-secondary hover:bg-surface-hover transition-colors"
          >
            <div className="text-sm font-medium text-text-primary mb-0.5">
              {t('modals.packageRestore.freeTitle')}
            </div>
            <div className="text-xs text-text-secondary">
              {t('modals.packageRestore.freeDesc')}
            </div>
          </button>

          <button
            onClick={onCancel}
            className="w-full px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            {t('modals.packageRestore.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
