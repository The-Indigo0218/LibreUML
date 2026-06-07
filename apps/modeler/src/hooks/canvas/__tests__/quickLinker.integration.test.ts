/**
 * useQuickLinker — integration coverage for the "drop a connection on empty
 * canvas → create node + relation in one undo" flow (R5).
 *
 * KonvaCanvas opens a type picker on the drop; choosing a type calls
 * createNodeAndConnect. The drag/picker UI is not simulatable under the
 * react-konva test mock, so we drive createNodeAndConnect directly and assert:
 *   - a new ViewNode AND a new ViewEdge appear,
 *   - the underlying element AND relation are created in the model,
 *   - one ViewEdge/relation links the source to the new node,
 *   - a SINGLE Ctrl+Z reverts BOTH (one undo transaction).
 *
 * Standalone path writes everything into the file's localModel, so a single
 * vfs scope undo covers node + relation + element together.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useQuickLinker } from '../useQuickLinker';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useWorkspaceStore } from '../../../store/workspace.store';
import { undoManager } from '../../../core/undo/instance';
import type { LibreUMLProject } from '../../../core/domain/vfs/vfs.types';

const FILE_ID = 'file-1';
const SOURCE_VN_ID = 'vn-source';
const SOURCE_ELEMENT_ID = 'cls-source';

function standaloneProjectWithSourceClass(): LibreUMLProject {
  const now = Date.now();
  return {
    id: 'proj-1',
    projectName: 'Test',
    version: '1.0.0',
    domainModelId: 'dm-1',
    nodes: {
      [FILE_ID]: {
        id: FILE_ID,
        name: 'Diagram.luml',
        type: 'FILE',
        parentId: null,
        diagramType: 'CLASS_DIAGRAM',
        extension: '.luml',
        isExternal: false,
        standalone: true,
        localModel: {
          id: 'lm-1',
          name: 'Diagram (standalone)',
          version: '1.0.0',
          packages: {}, classes: {
            [SOURCE_ELEMENT_ID]: { id: SOURCE_ELEMENT_ID, name: 'Source', kind: 'CLASS', attributeIds: [], operationIds: [] },
          },
          interfaces: {}, enums: {}, dataTypes: {}, attributes: {}, operations: {},
          actors: {}, useCases: {}, activityNodes: {}, objectInstances: {}, components: {},
          nodes: {}, artifacts: {}, relations: {}, packageNames: [],
          createdAt: now, updatedAt: now,
        },
        content: {
          diagramId: FILE_ID,
          nodes: [{ id: SOURCE_VN_ID, elementId: SOURCE_ELEMENT_ID, x: 0, y: 0 }],
          edges: [],
        },
        createdAt: now,
        updatedAt: now,
      } as any,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function view() {
  const file = useVFSStore.getState().project!.nodes[FILE_ID] as any;
  return file.content;
}
function localModel() {
  const file = useVFSStore.getState().project!.nodes[FILE_ID] as any;
  return file.localModel;
}

function renderLinker() {
  return renderHook(() => useQuickLinker({ activeTabId: FILE_ID })).result.current;
}

beforeEach(() => {
  undoManager.clear();
  useVFSStore.getState().loadProject(standaloneProjectWithSourceClass());
  // Palette mode → relation kind. INHERITANCE maps to GENERALIZATION.
  useWorkspaceStore.setState({ connectionModes: { [FILE_ID]: 'INHERITANCE' } } as any);
});

describe('useQuickLinker.createNodeAndConnect', () => {
  it('creates one new ViewNode and one new ViewEdge on the diagram', () => {
    const { createNodeAndConnect } = renderLinker();
    createNodeAndConnect(SOURCE_VN_ID, 'class', { x: 300, y: 200 });

    expect(view().nodes).toHaveLength(2);   // source + new
    expect(view().edges).toHaveLength(1);   // the linker edge
  });

  it('creates the backing class element and the relation in the local model', () => {
    const { createNodeAndConnect } = renderLinker();
    createNodeAndConnect(SOURCE_VN_ID, 'class', { x: 300, y: 200 });

    const lm = localModel();
    // source class + the new one
    expect(Object.keys(lm.classes)).toHaveLength(2);
    const rels = Object.values(lm.relations) as any[];
    expect(rels).toHaveLength(1);
    expect(rels[0].kind).toBe('GENERALIZATION');
  });

  it('links the relation from the source element to the new element', () => {
    const { createNodeAndConnect } = renderLinker();
    createNodeAndConnect(SOURCE_VN_ID, 'class', { x: 300, y: 200 });

    const lm = localModel();
    const rel = (Object.values(lm.relations) as any[])[0];
    const newClassId = Object.keys(lm.classes).find((id) => id !== SOURCE_ELEMENT_ID)!;
    const newViewNode = view().nodes.find((n: any) => n.id !== SOURCE_VN_ID);

    expect(rel.sourceId).toBe(SOURCE_ELEMENT_ID);
    expect(rel.targetId).toBe(newClassId);
    expect(newViewNode.elementId).toBe(newClassId);
  });

  it('centers the new node box on the drop point', () => {
    const { createNodeAndConnect } = renderLinker();
    createNodeAndConnect(SOURCE_VN_ID, 'class', { x: 300, y: 200 });
    const newVN = view().nodes.find((n: any) => n.id !== SOURCE_VN_ID);
    // NODE_WIDTH 256 / NODE_HEIGHT 120 → centered.
    expect(newVN.x).toBe(300 - 128);
    expect(newVN.y).toBe(200 - 60);
  });

  it('new edges default to straight routing mode', () => {
    const { createNodeAndConnect } = renderLinker();
    createNodeAndConnect(SOURCE_VN_ID, 'class', { x: 300, y: 200 });
    expect(view().edges[0].routingMode).toBe('straight');
  });

  it('records exactly ONE undo step and a single undo reverts node + edge + relation', () => {
    const { createNodeAndConnect } = renderLinker();
    createNodeAndConnect(SOURCE_VN_ID, 'class', { x: 300, y: 200 });
    expect(undoManager.getUndoStack(FILE_ID)).toHaveLength(1);

    undoManager.undo(FILE_ID);

    expect(view().nodes).toHaveLength(1);            // back to just source
    expect(view().edges).toHaveLength(0);
    expect(Object.keys(localModel().classes)).toHaveLength(1);
    expect(Object.keys(localModel().relations)).toHaveLength(0);
  });

  it('is a no-op for an unknown source ViewNode id', () => {
    const { createNodeAndConnect } = renderLinker();
    createNodeAndConnect('does-not-exist', 'class', { x: 0, y: 0 });
    expect(view().nodes).toHaveLength(1);
    expect(view().edges).toHaveLength(0);
    expect(undoManager.getUndoStack(FILE_ID)).toHaveLength(0);
  });
});
