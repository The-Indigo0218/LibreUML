import { createPortal } from 'react-dom';
import { X, FileText, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { IRUseCase } from '../../../../core/domain/vfs/vfs.types';

interface Props {
  uc: IRUseCase;
  screenX: number;
  screenY: number;
  onClose: () => void;
  onOpenSpec: () => void;
}

export default function UseCaseHoverPopover({ uc, screenX, screenY, onClose, onOpenSpec }: Props) {
  const { t } = useTranslation();
  const hasAnySpec = !!(
    uc.briefDescription || uc.preconditions || uc.postconditions ||
    uc.basicFlow?.length || uc.alternativeFlows?.length
  );

  // Smart positioning: prefer right of node, flip left if near right edge
  const viewportW = window.innerWidth;
  const popoverW = 300;
  const left = screenX + 16 + popoverW > viewportW
    ? screenX - popoverW - 8
    : screenX + 16;

  const content = (
    <div
      className="fixed z-[9000] w-[300px] rounded-lg border border-[#2a3358] bg-[#111827] shadow-xl text-sm"
      style={{ left, top: screenY - 8 }}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-3.5 h-3.5 shrink-0 text-blue-400" />
          <span className="font-semibold text-[#e2e8f0] truncate">{uc.name}</span>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-0.5 rounded hover:bg-[#1e2738] text-[#64748b] hover:text-[#94a3b8] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 pb-2 space-y-2">
        {!hasAnySpec ? (
          <p className="text-[#64748b] text-xs italic">
            {t('useCase.noSpec.hint')}
          </p>
        ) : (
          <>
            {uc.briefDescription && (
              <p className="text-[#94a3b8] text-xs leading-relaxed line-clamp-2">
                {uc.briefDescription}
              </p>
            )}

            {uc.preconditions && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#60a5fa]">
                  {t('useCase.preconditions')}
                </span>
                <p className="text-[#94a3b8] text-xs mt-0.5 line-clamp-2">{uc.preconditions}</p>
              </div>
            )}

            {uc.basicFlow && uc.basicFlow.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#60a5fa]">
                  {t('useCase.basicFlow')}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {uc.basicFlow.slice(0, 3).map((step) => (
                    <p key={step.id} className="text-[#94a3b8] text-xs">
                      <span className="text-[#475569] mr-1">{step.stepNumber}.</span>
                      {step.description.length > 55
                        ? step.description.slice(0, 55) + '…'
                        : step.description}
                    </p>
                  ))}
                  {uc.basicFlow.length > 3 && (
                    <p className="text-[#475569] text-xs">
                      {t('useCase.moreSteps', { count: uc.basicFlow.length - 3 })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {uc.alternativeFlows && uc.alternativeFlows.length > 0 && (
              <p className="text-[#64748b] text-xs">
                {t('useCase.alternativeFlowCount', { count: uc.alternativeFlows.length })}
              </p>
            )}
          </>
        )}
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={() => { onClose(); onOpenSpec(); }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-[#1e2738] hover:bg-[#253047] text-[#7C83FF] hover:text-[#9499ff] text-xs font-medium transition-colors"
        >
          <span>{hasAnySpec ? t('useCase.viewFullSpec') : t('useCase.addSpec')}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
