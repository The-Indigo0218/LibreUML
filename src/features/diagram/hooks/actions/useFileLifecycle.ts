import { useCallback, useRef } from "react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useProjectStore } from "../../../../store/project.store";
import { useSettingsStore } from "../../../../store/settingsStore";
import { useUiStore } from "../../../../store/uiStore";
import type { DiagramType } from "../../../../core/domain/workspace/diagram-file.types";

/**
 *  SSOT Implementation
 * 
 * Manages diagram file operations using WorkspaceStore + ProjectStore:
 * - Create new diagrams
 * - Open/Save diagrams (Electron integration)
 * - Import from web (file upload)
 * - Revert to saved state
 * - Close project (Phase 8.2)
 * - Universal file picker with orchestration (Phase 8.4)
 */
export const useFileLifecycle = () => {
  const createNewFile = useWorkspaceStore((s) => s.createNewFile);
  const addFile = useWorkspaceStore((s) => s.addFile);
  const getActiveFile = useWorkspaceStore((s) => s.getActiveFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const markFileClean = useWorkspaceStore((s) => s.markFileClean);
  const clearWorkspace = useWorkspaceStore((s) => s.clearWorkspace);
  const setLastFilePath = useSettingsStore((s) => s.setLastFilePath);

  const getNodes = useProjectStore((s) => s.getNodes);
  const getEdges = useProjectStore((s) => s.getEdges);
  const addNodes = useProjectStore((s) => s.addNodes);
  const addEdges = useProjectStore((s) => s.addEdges);
  const clearProject = useProjectStore((s) => s.clearProject);

  const openNotAProjectModal = useUiStore((s) => s.openNotAProjectModal);
  const setIsFileLoading = useUiStore((s) => s.setIsFileLoading);

  // Hidden file input ref for web fallback
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const createNewDiagram = useCallback(
    (diagramType: DiagramType = "CLASS_DIAGRAM", name?: string) => {
      const newFile = createNewFile(diagramType, name);
      addFile(newFile);
      return newFile;
    },
    [createNewFile, addFile]
  );

  /**
   * PHASE 8.4: Universal File Picker with Web Fallback
   * PHASE 8.5: Added loading state and unified flow for all file types
   * 
   * Opens a file picker that works in both Electron and Web environments.
   * Intercepts file loading with "Not a Project" orchestration modal.
   */
  const openDiagramFromDisk = useCallback(async () => {
    // Electron path
    if (window.electronAPI?.isElectron()) {
      try {
        setIsFileLoading(true);
        const result = await window.electronAPI.openFile();

        if (result.canceled || !result.content) {
          setIsFileLoading(false);
          return;
        }

        const fileName = result.filePath?.split('/').pop() || 'Unknown';
        const fileType = fileName.endsWith('.xmi') ? 'xmi' : 'luml';

        setIsFileLoading(false);

        // PHASE 8.4: Intercept with orchestration modal for ALL file types
        openNotAProjectModal(fileName, result.content, fileType);
      } catch (error) {
        setIsFileLoading(false);
        console.error("[FileLifecycle] Error opening diagram:", error);
        throw error;
      }
      return;
    }

    // Web fallback
    console.log("[FileLifecycle] Using web file picker fallback");
    
    // Create hidden input if it doesn't exist
    if (!fileInputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.luml,.xmi,.json';
      input.style.display = 'none';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
          setIsFileLoading(true);
          const content = await file.text();
          const fileName = file.name;
          const fileType = fileName.endsWith('.xmi') ? 'xmi' : 'luml';

          setIsFileLoading(false);

          // PHASE 8.4: Intercept with orchestration modal for ALL file types
          openNotAProjectModal(fileName, content, fileType);
        } catch (error) {
          setIsFileLoading(false);
          console.error("[FileLifecycle] Error reading file:", error);
          alert("Error reading file. Please try again.");
        }
      };

      document.body.appendChild(input);
      fileInputRef.current = input;
    }

    // Trigger file picker
    fileInputRef.current.click();
  }, [openNotAProjectModal, setIsFileLoading]);

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

  /**
   * PHASE 8.2: Close Project - Total State Annihilation
   * 
   * Performs a complete reset of all application state:
   * - Clears all files from WorkspaceStore
   * - Clears all nodes and edges from ProjectStore
   * - Purges Zundo history to prevent state leakage
   * - Returns to Welcome Screen
   * 
   * NOTE: This should ALWAYS be called with a confirmation dialog.
   */
  const closeProject = useCallback(() => {
    console.log("[FileLifecycle] Closing project - performing total state reset");
    
    // Clear workspace (files, activeFileId)
    clearWorkspace();
    
    // Clear project data and purge history
    clearProject();
    
    console.log("[FileLifecycle] Project closed - Welcome Screen should now be visible");
  }, [clearWorkspace, clearProject]);

  /**
   * PHASE 8.4: Process file after "Not a Project" modal confirmation
   * PHASE 8.5: Stub implementation - content parameter will be used in Phase 9
   * 
   * This is a stub for Phase 9. Currently just creates a new diagram
   * to clear the Welcome Screen.
   */
  const processFileFromModal = useCallback((fileName: string, _content: string, fileType: 'luml' | 'xmi') => {
    console.log("[FileLifecycle] Phase 9 Trigger: Create project from file", fileName, fileType);
    
    // PHASE 8.5: Stub - just create a new diagram to clear Welcome Screen
    // Phase 9 will use _content to parse and populate the workspace
    createNewDiagram("CLASS_DIAGRAM", fileName.replace(/\.(luml|xmi|json)$/, ""));
  }, [createNewDiagram]);

  return {
    createNewDiagram,
    openDiagramFromDisk,
    importFromWeb,
    saveDiagram,
    saveDiagramAs,
    revertDiagram,
    closeProject,
    processFileFromModal,
  };
};
