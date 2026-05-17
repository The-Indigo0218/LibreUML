import { useCallback } from "react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { openLumlFile } from "../../../../services/openFileService";
import type { DiagramType } from "../../../../core/domain/workspace/diagram-file.types";

export const useFileLifecycle = () => {
  const createNewDiagram = useCallback(
    (diagramType: DiagramType = "CLASS_DIAGRAM", name?: string) => {
      const vfsState = useVFSStore.getState();
      if (!vfsState.project) return null;
      const fileId = vfsState.createFile(
        null,
        name || `New Diagram`,
        diagramType,
        ".luml",
      );
      useWorkspaceStore.getState().openTab(fileId);
      return fileId;
    },
    [],
  );

  const importFromWeb = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await openLumlFile(file, "standalone");
      } catch (error) {
        console.error("[FileLifecycle] Error importing diagram:", error);
        throw error;
      }
    },
    [],
  );

  const openDiagramFromDisk = useCallback(async () => {}, []);
  const saveDiagram = useCallback(async () => false as boolean, []);
  const saveDiagramAs = useCallback(async () => {}, []);
  const revertDiagram = useCallback(async () => {}, []);

  return {
    createNewDiagram,
    importFromWeb,
    openDiagramFromDisk,
    saveDiagram,
    saveDiagramAs,
    revertDiagram,
  };
};
