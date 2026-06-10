import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface CrossDiagramDropModalProps {
  /** Human-readable label of the tool being dropped (already translated). */
  toolLabel: string;
  /** Display name of the active diagram type. */
  diagramLabel: string;
  onAddAnyway: () => void;
  onCancel: () => void;
}

/**
 * Shown when the user drops a node tool that the active diagram type does not
 * natively own. Offers a best-effort "add anyway" (free mode) or to abstain.
 * Mirrors the layout of PackageHierarchyModal for visual consistency.
 */
export default function CrossDiagramDropModal({
  toolLabel,
  diagramLabel,
  onAddAnyway,
  onCancel,
}: CrossDiagramDropModalProps) {
  const { t } = useTranslation();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-text-primary mb-2">
          {t('modals.crossDiagram.title')}
        </h2>

        <p className="text-sm text-text-secondary mb-5">
          {t('modals.crossDiagram.description', {
            tool: toolLabel,
            diagram: diagramLabel,
          })}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onAddAnyway}
            className="w-full text-left px-4 py-3 rounded-lg border border-surface-border bg-surface-secondary hover:bg-surface-hover transition-colors"
          >
            <div className="text-sm font-medium text-text-primary mb-0.5">
              {t('modals.crossDiagram.addAnywayTitle')}
            </div>
            <div className="text-xs text-text-secondary">
              {t('modals.crossDiagram.addAnywayDesc')}
            </div>
          </button>

          <button
            onClick={onCancel}
            className="w-full px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            {t('modals.crossDiagram.abstain')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
