import { useUiStore } from './uiStore';
import { useActiveSemanticModelOps } from './useActiveSemanticModelOps';
import type { SemanticModel } from '../core/domain/vfs/vfs.types';

export function useEditingEntity<T>(
  modalType: string,
  selector: (model: SemanticModel | null | undefined, id: string) => T | null
) {
  const { activeModal, editingId, closeModals } = useUiStore();
  const { getModel, getOps } = useActiveSemanticModelOps();

  const isOpen = activeModal === modalType && !!editingId;

  function getEntity(): T | null {
    if (!editingId) return null;
    return selector(getModel(), editingId);
  }

  return { isOpen, editingId, closeModals, getEntity, getOps, getModel };
}
