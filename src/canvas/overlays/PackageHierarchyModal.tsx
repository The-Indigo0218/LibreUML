import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface PackageHierarchyModalProps {
  packageFullPath: string;
  parentPath: string;
  classCount: number;
  subPackageCount: number;
  onPlaceSimple: () => void;
  onPlaceHierarchy: () => void;
  onCancel: () => void;
}

export default function PackageHierarchyModal({
  packageFullPath,
  parentPath,
  classCount,
  subPackageCount,
  onPlaceSimple,
  onPlaceHierarchy,
  onCancel,
}: PackageHierarchyModalProps) {
  const { t } = useTranslation();
  
  const elementLabel = t('modals.packageHierarchy.class', { count: classCount });
  const pkgLabel = t('modals.packageHierarchy.subPackage', { count: subPackageCount });

  const parts: string[] = [];
  if (classCount > 0) parts.push(elementLabel);
  if (subPackageCount > 0) parts.push(pkgLabel);
  const contentSummary = parts.join(` ${t('modals.packageHierarchy.and')} `);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-text-primary mb-2">
          {t('modals.packageHierarchy.title')}
        </h2>

        <p className="text-sm text-text-secondary mb-5">
          {t('modals.packageHierarchy.parentContains', { 
            parentPath, 
            content: contentSummary 
          })}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onPlaceSimple}
            className="w-full text-left px-4 py-3 rounded-lg border border-surface-border bg-surface-secondary hover:bg-surface-hover transition-colors"
          >
            <div className="text-sm font-medium text-text-primary mb-0.5">
              {t('modals.packageHierarchy.placeOnlyTitle', { packagePath: packageFullPath })}
            </div>
            <div className="text-xs text-text-secondary">
              {t('modals.packageHierarchy.placeOnlyDesc')}
            </div>
          </button>

          <button
            onClick={onPlaceHierarchy}
            className="w-full text-left px-4 py-3 rounded-lg border border-surface-border bg-surface-secondary hover:bg-surface-hover transition-colors"
          >
            <div className="text-sm font-medium text-text-primary mb-0.5">
              {t('modals.packageHierarchy.placeHierarchyTitle', { parentPath })}
            </div>
            <div className="text-xs text-text-secondary">
              {t('modals.packageHierarchy.placeHierarchyDesc')}
            </div>
          </button>

          <button
            onClick={onCancel}
            className="w-full px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            {t('modals.packageHierarchy.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
