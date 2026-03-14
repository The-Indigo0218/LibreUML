import { useCallback } from "react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useProjectStore } from "../../../../store/project.store";
import { useSettingsStore } from "../../../../store/settingsStore";
import type { DiagramType } from "../../../../core/domain/workspace/diagram-file.types";

/**
 *  SSOT Implementation
 * 
 * Manages diagram file operations using WorkspaceStore + ProjectStore:
 * - Create new diagrams
 * - Open/Save diagrams (Electron integration)
 * - Import from web (file upload)
 * - Revert to saved state
 */
export const useFileLifecycle = () => {
  const createNewFile = useWorkspaceStore((s) => s.createNewFile);
  const addFile = useWorkspaceStore((s) => s.addFile);
  const getActiveFile = useWorkspaceStore((s) => s.getActiveFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const markFileClean = useWorkspaceStore((s) => s.markFileClean);
  const setLastFilePath = useSettingsStore((s) => s.setLastFilePath);

  const getNodes = useProjectStore((s) => s.getNodes);
  const getEdges = useProjectStore((s) => s.getEdges);
  const addNodes = useProjectStore((s) => s.addNodes);
  const addEdges = useProjectStore((s) => s.addEdges);

  const createNewDiagram = useCallback(
    (diagramType: DiagramType = "CLASS_DIAGRAM", name?: string) => {
      const newFile = createNewFile(diagramType, name);
      addFile(newFile);
      return newFile;
    },
    [createNewFile, addFile]
  );

  const openDiagramFromDisk = useCallback(async () => {
    if (!window.electronAPI?.isElectron()) {
      console.warn("Open from disk is only available in Electron");
      return;
    }

    try {
      const result = await window.electronAPI.openFile();

      if (result.canceled || !result.content) {
        return;
      }

      const data = JSON.parse(result.content);

      // Create new file in workspace
      const newFile = createNewFile(
        data.diagramType || "CLASS_DIAGRAM",
        data.name || "Untitled"
      );

      // Populate ProjectStore with nodes and edges
      if (data.nodes && Array.isArray(data.nodes)) {
        addNodes(data.nodes);
      }

      if (data.edges && Array.isArray(data.edges)) {
        addEdges(data.edges);
      }

      // Update file with loaded data
      updateFile(newFile.id, {
        name: data.name || newFile.name,
        nodeIds: data.nodes?.map((n: any) => n.id) || [],
        edgeIds: data.edges?.map((e: any) => e.id) || [],
        viewport: data.viewport || newFile.viewport,
        metadata: {
          ...newFile.metadata,
          filePath: result.filePath,
          positionMap: data.positionMap || {},
        } as any,
        isDirty: false,
      });

      // Add file to workspace
      addFile(newFile);
      if (result.filePath) {
        setLastFilePath(result.filePath);
      }

      console.log(`[FileLifecycle] Opened diagram from: ${result.filePath}`);
    } catch (error) {
      console.error("[FileLifecycle] Error opening diagram:", error);
      throw error;
    }
  }, [createNewFile, addNodes, addEdges, updateFile, addFile, setLastFilePath]);

  const importFromWeb = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Create new file in workspace
        const newFile = createNewFile(
          data.diagramType || "CLASS_DIAGRAM",
          data.name || file.name.replace(".luml", "")
        );

        // Populate ProjectStore
        if (data.nodes && Array.isArray(data.nodes)) {
          addNodes(data.nodes);
        }

        if (data.edges && Array.isArray(data.edges)) {
          addEdges(data.edges);
        }

        // Update file with loaded data
        updateFile(newFile.id, {
          name: data.name || newFile.name,
          nodeIds: data.nodes?.map((n: any) => n.id) || [],
          edgeIds: data.edges?.map((e: any) => e.id) || [],
          viewport: data.viewport || newFile.viewport,
          metadata: {
            ...newFile.metadata,
            positionMap: data.positionMap || {},
          } as any,
          isDirty: false,
        });

        // Add file to workspace
        addFile(newFile);

        console.log(`[FileLifecycle] Imported diagram from web: ${file.name}`);
      } catch (error) {
        console.error("[FileLifecycle] Error importing diagram:", error);
        throw error;
      }
    },
    [createNewFile, addNodes, addEdges, updateFile, addFile]
  );

  const saveDiagram = useCallback(async () => {
    const file = getActiveFile();
    if (!file) {
      console.warn("[FileLifecycle] No active file to save");
      return false;
    }

    if (!window.electronAPI?.isElectron()) {
      console.warn("Save is only available in Electron");
      return false;
    }

    try {
      const metadata = file.metadata as any;
      const filePath = metadata?.filePath;

      // Get domain data from ProjectStore
      const nodes = getNodes(file.nodeIds);
      const edges = getEdges(file.edgeIds);

      const saveData = {
        id: file.id,
        name: file.name,
        diagramType: file.diagramType,
        nodes,
        edges,
        viewport: file.viewport,
        positionMap: metadata?.positionMap || {},
      };

      const content = JSON.stringify(saveData, null, 2);

      const result = await window.electronAPI.saveFile(
        content,
        filePath,
        file.name,
        ['luml']
      );

      if (result.canceled) {
        return false;
      }

      // Update file metadata with path
      if (result.filePath) {
        updateFile(file.id, {
          metadata: {
            ...metadata,
            filePath: result.filePath,
          } as any,
        });
        setLastFilePath(result.filePath);
      }

      markFileClean(file.id);
      console.log(`[FileLifecycle] Saved diagram to: ${result.filePath}`);
      return true;
    } catch (error) {
      console.error("[FileLifecycle] Error saving diagram:", error);
      return false;
    }
  }, [getActiveFile, getNodes, getEdges, updateFile, markFileClean, setLastFilePath]);

  const saveDiagramAs = useCallback(async () => {
    const file = getActiveFile();
    if (!file) {
      console.warn("[FileLifecycle] No active file to save");
      return;
    }

    if (!window.electronAPI?.isElectron()) {
      console.warn("Save As is only available in Electron");
      return;
    }

    try {
      const metadata = file.metadata as any;

      // Get domain data from ProjectStore
      const nodes = getNodes(file.nodeIds);
      const edges = getEdges(file.edgeIds);

      const saveData = {
        id: file.id,
        name: file.name,
        diagramType: file.diagramType,
        nodes,
        edges,
        viewport: file.viewport,
        positionMap: metadata?.positionMap || {},
      };

      const content = JSON.stringify(saveData, null, 2);

      // Force save dialog by not passing filePath
      const result = await window.electronAPI.saveFile(
        content,
        undefined,
        file.name,
        ['luml']
      );

      if (result.canceled) {
        return;
      }

      // Update file metadata with new path
      if (result.filePath) {
        updateFile(file.id, {
          metadata: {
            ...metadata,
            filePath: result.filePath,
          } as any,
        });
        setLastFilePath(result.filePath);
      }

      markFileClean(file.id);
      console.log(`[FileLifecycle] Saved diagram as: ${result.filePath}`);
    } catch (error) {
      console.error("[FileLifecycle] Error saving diagram as:", error);
      throw error;
    }
  }, [getActiveFile, getNodes, getEdges, updateFile, markFileClean, setLastFilePath]);

  const revertDiagram = useCallback(async () => {
    const file = getActiveFile();
    if (!file) {
      console.warn("[FileLifecycle] No active file to revert");
      return;
    }

    const metadata = file.metadata as any;
    const filePath = metadata?.filePath;

    if (!filePath) {
      console.warn("[FileLifecycle] Cannot revert: file has no saved path");
      return;
    }

    if (!window.electronAPI?.isElectron()) {
      console.warn("Revert is only available in Electron");
      return;
    }

    try {
      // Reload file from disk
      const result = await window.electronAPI.readFile(filePath);

      if (!result.success || !result.content) {
        console.error("[FileLifecycle] Failed to reload file");
        return;
      }

      const data = JSON.parse(result.content);

      // Update ProjectStore with reloaded data
      if (data.nodes && Array.isArray(data.nodes)) {
        addNodes(data.nodes);
      }

      if (data.edges && Array.isArray(data.edges)) {
        addEdges(data.edges);
      }

      // Update file with reloaded data
      updateFile(file.id, {
        name: data.name || file.name,
        nodeIds: data.nodes?.map((n: any) => n.id) || [],
        edgeIds: data.edges?.map((e: any) => e.id) || [],
        viewport: data.viewport || file.viewport,
        metadata: {
          ...metadata,
          positionMap: data.positionMap || {},
        } as any,
        isDirty: false,
      });

      console.log(`[FileLifecycle] Reverted diagram from: ${filePath}`);
    } catch (error) {
      console.error("[FileLifecycle] Error reverting diagram:", error);
      throw error;
    }
  }, [getActiveFile, addNodes, addEdges, updateFile]);

  return {
    createNewDiagram,
    openDiagramFromDisk,
    importFromWeb,
    saveDiagram,
    saveDiagramAs,
    revertDiagram,
  };
};
