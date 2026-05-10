import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../workspace.store';

describe('Workspace Store', () => {
  beforeEach(() => {
    // Clear the store before each test
    useWorkspaceStore.getState().closeAllFiles();
  });

  describe('File Management', () => {
    it('should add a file and set it as active', () => {
      const file = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM', 'Test Diagram');
      useWorkspaceStore.getState().addFile(file);

      expect(useWorkspaceStore.getState().files).toHaveLength(1);
      expect(useWorkspaceStore.getState().activeFileId).toBe(file.id);
    });

    it('should remove a file', () => {
      const file = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM');
      useWorkspaceStore.getState().addFile(file);
      useWorkspaceStore.getState().removeFile(file.id);

      expect(useWorkspaceStore.getState().files).toHaveLength(0);
      expect(useWorkspaceStore.getState().activeFileId).toBeNull();
    });

    it('should switch active file when removing active file', () => {
      const file1 = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM', 'File 1');
      const file2 = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM', 'File 2');
      
      useWorkspaceStore.getState().addFile(file1);
      useWorkspaceStore.getState().addFile(file2);
      
      // file2 is now active
      expect(useWorkspaceStore.getState().activeFileId).toBe(file2.id);
      
      // Remove active file
      useWorkspaceStore.getState().removeFile(file2.id);
      
      // Should switch to file1
      expect(useWorkspaceStore.getState().activeFileId).toBe(file1.id);
    });

    it('should update a file', () => {
      const file = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM', 'Original Name');
      useWorkspaceStore.getState().addFile(file);
      
      useWorkspaceStore.getState().updateFile(file.id, { name: 'Updated Name' });
      
      const updatedFile = useWorkspaceStore.getState().getFile(file.id);
      expect(updatedFile?.name).toBe('Updated Name');
    });

    it('should get active file', () => {
      const file = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM');
      useWorkspaceStore.getState().addFile(file);
      
      const activeFile = useWorkspaceStore.getState().getActiveFile();
      expect(activeFile?.id).toBe(file.id);
    });
  });

  describe('File Content Management', () => {
    it('should add node ID to file', () => {
      const file = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM');
      useWorkspaceStore.getState().addFile(file);
      
      useWorkspaceStore.getState().addNodeToFile(file.id, 'node-1');
      
      const updatedFile = useWorkspaceStore.getState().getFile(file.id);
      expect(updatedFile?.nodeIds).toContain('node-1');
      expect(updatedFile?.isDirty).toBe(true);
    });

    it('should remove node ID from file', () => {
      const file = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM');
      useWorkspaceStore.getState().addFile(file);
      
      useWorkspaceStore.getState().addNodeToFile(file.id, 'node-1');
      useWorkspaceStore.getState().removeNodeFromFile(file.id, 'node-1');
      
      const updatedFile = useWorkspaceStore.getState().getFile(file.id);
      expect(updatedFile?.nodeIds).not.toContain('node-1');
    });

    it('should add edge ID to file', () => {
      const file = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM');
      useWorkspaceStore.getState().addFile(file);
      
      useWorkspaceStore.getState().addEdgeToFile(file.id, 'edge-1');
      
      const updatedFile = useWorkspaceStore.getState().getFile(file.id);
      expect(updatedFile?.edgeIds).toContain('edge-1');
      expect(updatedFile?.isDirty).toBe(true);
    });

    it('should remove edge ID from file', () => {
      const file = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM');
      useWorkspaceStore.getState().addFile(file);
      
      useWorkspaceStore.getState().addEdgeToFile(file.id, 'edge-1');
      useWorkspaceStore.getState().removeEdgeFromFile(file.id, 'edge-1');
      
      const updatedFile = useWorkspaceStore.getState().getFile(file.id);
      expect(updatedFile?.edgeIds).not.toContain('edge-1');
    });
  });

  describe('Viewport Management', () => {
    it('should update file viewport', () => {
      const file = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM');
      useWorkspaceStore.getState().addFile(file);
      
      const newViewport = { x: 100, y: 200, zoom: 1.5 };
      useWorkspaceStore.getState().updateFileViewport(file.id, newViewport);
      
      const updatedFile = useWorkspaceStore.getState().getFile(file.id);
      expect(updatedFile?.viewport).toEqual(newViewport);
    });
  });

  describe('Dirty State Management', () => {
    it('should mark file as dirty', () => {
      const file = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM');
      useWorkspaceStore.getState().addFile(file);
      
      useWorkspaceStore.getState().markFileDirty(file.id);
      
      const updatedFile = useWorkspaceStore.getState().getFile(file.id);
      expect(updatedFile?.isDirty).toBe(true);
    });

    it('should mark file as clean', () => {
      const file = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM');
      useWorkspaceStore.getState().addFile(file);
      
      useWorkspaceStore.getState().markFileDirty(file.id);
      useWorkspaceStore.getState().markFileClean(file.id);
      
      const updatedFile = useWorkspaceStore.getState().getFile(file.id);
      expect(updatedFile?.isDirty).toBe(false);
    });
  });

  describe('File Creation', () => {
    it('should create a new Class Diagram file', () => {
      const file = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM', 'My Diagram');
      
      expect(file.id).toBeDefined();
      expect(file.name).toBe('My Diagram');
      expect(file.diagramType).toBe('CLASS_DIAGRAM');
      expect(file.nodeIds).toEqual([]);
      expect(file.edgeIds).toEqual([]);
      expect(file.isDirty).toBe(false);
      expect(file.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('should create a new Use Case Diagram file', () => {
      const file = useWorkspaceStore.getState().createNewFile('USE_CASE_DIAGRAM');
      
      expect(file.diagramType).toBe('USE_CASE_DIAGRAM');
      expect(file.name).toContain('USE_CASE_DIAGRAM');
    });

    it('should use default name if not provided', () => {
      const file = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM');
      
      expect(file.name).toContain('CLASS_DIAGRAM');
    });
  });

  describe('Active File Switching', () => {
    it('should switch active file', () => {
      const file1 = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM', 'File 1');
      const file2 = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM', 'File 2');
      
      useWorkspaceStore.getState().addFile(file1);
      useWorkspaceStore.getState().addFile(file2);
      
      useWorkspaceStore.getState().switchFile(file1.id);
      
      expect(useWorkspaceStore.getState().activeFileId).toBe(file1.id);
    });
  });

  describe('Close All Files', () => {
    it('should close all files', () => {
      const file1 = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM');
      const file2 = useWorkspaceStore.getState().createNewFile('CLASS_DIAGRAM');
      
      useWorkspaceStore.getState().addFile(file1);
      useWorkspaceStore.getState().addFile(file2);
      
      useWorkspaceStore.getState().closeAllFiles();
      
      expect(useWorkspaceStore.getState().files).toHaveLength(0);
      expect(useWorkspaceStore.getState().activeFileId).toBeNull();
    });
  });
});
