import { useCallback } from "react";

/**
 * TODO: SSOT Migration - File Lifecycle
 * 
 * This hook needs complete rewrite to use WorkspaceStore + ProjectStore.
 * The legacy version used DiagramState format which is incompatible with SSOT.
 * 
 * Required changes:
 * - Replace loadDiagram/resetDiagram with WorkspaceStore file operations
 * - Update save/load to use SSOT format (separate nodes/edges in ProjectStore)
 * - Implement proper file path management via WorkspaceStore
 * - Handle viewport state per file
 * 
 * For now, returning stub functions to prevent build errors.
 */
export const useFileLifecycle = () => {
  const createNewDiagram = useCallback(() => {
    console.warn("TODO: SSOT - createNewDiagram not implemented");
  }, []);

  const openDiagramFromDisk = useCallback(async () => {
    console.warn("TODO: SSOT - openDiagramFromDisk not implemented");
  }, []);

  const importFromWeb = useCallback((_event: React.ChangeEvent<HTMLInputElement>) => {
    console.warn("TODO: SSOT - importFromWeb not implemented");
  }, []);

  const saveDiagram = useCallback(async () => {
    console.warn("TODO: SSOT - saveDiagram not implemented");
    return false;
  }, []);

  const saveDiagramAs = useCallback(async () => {
    console.warn("TODO: SSOT - saveDiagramAs not implemented");
  }, []);

  const revertDiagram = useCallback(async () => {
    console.warn("TODO: SSOT - revertDiagram not implemented");
  }, []);

  return {
    createNewDiagram,
    openDiagramFromDisk,
    importFromWeb,
    saveDiagram,
    saveDiagramAs,
    revertDiagram,
  };
};
