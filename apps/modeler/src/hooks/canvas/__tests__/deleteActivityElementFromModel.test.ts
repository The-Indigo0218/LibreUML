/**
 * "Delete from Model" never had a branch for `model.activityNodes` /
 * `model.activityPartitions` (any Activity phase, A1 through A6.2) — the
 * generic if/else chain in `deleteElementFromModel` only knew about
 * classes/interfaces/enums/packages/actors/useCases/systemBoundaries/
 * ucModules. The ViewNode-removal step below it runs unconditionally, so an
 * activity node "deleted" this way vanished from every diagram while its
 * `IRActivityNode`/`IRActivityPartition` stayed behind forever — an orphan
 * invisible on any canvas but still exported to XMI and still inflating the
 * `.luml` file. Found reviewing A6.2, fixed for every activity node kind
 * (not just pins), on both store surfaces (§10.4).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNodeActions } from '../useNodeActions';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { getLocalModel } from '../../../store/standaloneModelOps';
import { undoManager } from '../../../core/undo/instance';
import type { LibreUMLProject, SemanticModel } from '../../../core/domain/vfs/vfs.types';

const FILE = 'file-1';
const ACTION_VN = 'vn-action';
const ACTION_ELEM = 'action-1';
const PIN_VN = 'vn-pin';
const PIN_ELEM = 'pin-1';
const PART_VN = 'vn-part';
const PART_ELEM = 'part-1';
const OTHER_VN = 'vn-other';
const OTHER_ELEM = 'other-1';

function baseModel(): SemanticModel {
  const now = Date.now();
  return {
    id: 'dm-1', name: 'M', version: '1.0.0', packages: {},
    classes: {}, interfaces: {}, enums: {}, dataTypes: {}, attributes: {}, operations: {},
    actors: {}, useCases: {},
    activityNodes: {
      [ACTION_ELEM]: { id: ACTION_ELEM, kind: 'ACTIVITY_NODE', activityType: 'ACTION', activityId: 'act-1', name: 'Pay' },
      [PIN_ELEM]: { id: PIN_ELEM, kind: 'ACTIVITY_NODE', activityType: 'INPUT_PIN', activityId: 'act-1', name: '', ownerActionId: ACTION_ELEM },
      [OTHER_ELEM]: { id: OTHER_ELEM, kind: 'ACTIVITY_NODE', activityType: 'ACTION', activityId: 'act-1', name: 'Ship', partitionId: PART_ELEM },
    },
    activityPartitions: {
      [PART_ELEM]: { id: PART_ELEM, kind: 'ACTIVITY_PARTITION', activityId: 'act-1', name: 'Lane 1', index: 0 },
    },
    objectInstances: {}, components: {},
    nodes: {}, artifacts: {}, lifelines: {}, messages: {}, activations: {},
    interactionFragments: {}, stateInvariants: {}, interactionUses: {}, gates: {},
    relations: {}, packageNames: [], createdAt: now, updatedAt: now,
  } as unknown as SemanticModel;
}

function baseProject(standalone: boolean): LibreUMLProject {
  const now = Date.now();
  return {
    id: 'p', projectName: 'T', version: '1.0.0', domainModelId: 'dm-1',
    nodes: {
      [FILE]: {
        id: FILE, name: 'A.luml', type: 'FILE', parentId: null,
        diagramType: 'ACTIVITY_DIAGRAM', extension: '.luml', isExternal: false, standalone,
        content: {
          diagramId: FILE,
          nodes: [
            { id: ACTION_VN, elementId: ACTION_ELEM, x: 100, y: 100 },
            { id: PIN_VN, elementId: PIN_ELEM, x: 60, y: 100 },
            { id: PART_VN, elementId: PART_ELEM, x: 0, y: 0 },
            { id: OTHER_VN, elementId: OTHER_ELEM, x: 100, y: 200 },
          ],
          edges: [],
        },
        ...(standalone ? { localModel: baseModel() } : {}),
        createdAt: now, updatedAt: now,
      } as any,
    },
    createdAt: now, updatedAt: now,
  } as any;
}

describe.each([
  ['project-backed', false],
  ['standalone', true],
] as const)('deleteElementFromModel — activity nodes (%s)', (_label, standalone) => {
  beforeEach(() => {
    undoManager.clear();
    useVFSStore.getState().loadProject(baseProject(standalone));
    if (!standalone) useModelStore.getState().loadModel(baseModel());
  });

  function model(): SemanticModel {
    return standalone ? getLocalModel(FILE)! : useModelStore.getState().model!;
  }
  function viewNodeIds(): string[] {
    return ((useVFSStore.getState().project!.nodes[FILE] as any).content.nodes as { id: string }[]).map((n) => n.id);
  }
  function actions() {
    return renderHook(() =>
      useNodeActions({ activeTabId: FILE, isStandalone: standalone, updateFileContent: () => {} }),
    ).result.current;
  }

  it('deleting an action removes it AND its owned pin from the model and the diagram', () => {
    actions().deleteElementFromModel(ACTION_VN);

    expect(model().activityNodes[ACTION_ELEM]).toBeUndefined();
    expect(model().activityNodes[PIN_ELEM]).toBeUndefined();
    expect(model().activityNodes[OTHER_ELEM]).toBeDefined(); // untouched sibling

    const ids = viewNodeIds();
    expect(ids).not.toContain(ACTION_VN);
    expect(ids).not.toContain(PIN_VN);
    expect(ids).toContain(OTHER_VN);
  });

  it('deleting a lane removes it but only clears partitionId on its members, not the members themselves', () => {
    actions().deleteElementFromModel(PART_VN);

    expect(model().activityPartitions?.[PART_ELEM]).toBeUndefined();
    expect(model().activityNodes[OTHER_ELEM]).toBeDefined();
    expect(model().activityNodes[OTHER_ELEM].partitionId).toBeUndefined();

    const ids = viewNodeIds();
    expect(ids).not.toContain(PART_VN);
    expect(ids).toContain(OTHER_VN); // the lane's former member survives
  });
});
