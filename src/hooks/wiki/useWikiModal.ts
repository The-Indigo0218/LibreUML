import { useUiStore } from "../../store/uiStore";

export function useWikiModal() {
  const activeModal = useUiStore((s) => s.activeModal);
  const openWiki = useUiStore((s) => s.openWiki);
  const closeModals = useUiStore((s) => s.closeModals);

  return {
    isOpen: activeModal === "wiki",
    openModal: openWiki,
    closeModal: closeModals,
  };
}
