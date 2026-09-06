/**
 * A4 — traceability cascades wired into the real mutation sites, across BOTH
 * store surfaces (spec section 10.4): `setElementMembers` (action→operation)
 * and `deleteClass` (lane→responsible). See `activityTraceability.cascades.test.ts`
 * for the underlying pure functions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model.store';
import { standaloneModelOps, getLocalModel, ensureLocalModel } from '../standaloneModelOps';
import { useVFSStore } from '../project-vfs.store';
import type { SemanticModel } from '../../core/domain/vfs/vfs.types';

const FILE_ID = 'standalone-activity-file';

function freshStandaloneFile() {
  const now = Date.now();
  useVFSStore.getState().loadProject({
    id: 'proj-activity',
    projectName: 'Test',
    version: '1.0.0',
    domainModelId: 'dm-1',
    nodes: {
      [FILE_ID]: {
        id: FILE_ID,
        name: 'Flow.luml',
        type: 'FILE',
        parentId: null,
        diagramType: 'ACTIVITY_DIAGRAM',
        extension: '.luml',
        isExternal: false,
        standalone: true,
        content: { diagramId: FILE_ID, nodes: [], edges: [] },
        createdAt: now,
        updatedAt: now,
      } as never,
    },
    createdAt: now,
    updatedAt: now,
  } as never);
  ensureLocalModel(FILE_ID);
}

interface Surface {
  name: string;
  reset: () => void;
  model: () => SemanticModel;
  ops: () => {
    createClass: (d: never) => string;
    deleteClass: (id: string) => void;
    setElementMembers: (id: string, attrs: never[], ops: never[]) => void;
    createActivity: (d: never) => string;
    createActivityNode: (d: never) => string;
    updateActivityNode: (id: string, p: never) => void;
    createActivityPartition: (d: never) => string;
  };
}

const SURFACES: Surface[] = [
  {
    name: 'model.store (global)',
    reset: () => {
      useModelStore.getState().resetModel();
      useModelStore.getState().initModel('test-activity-model');
    },
    model: () => useModelStore.getState().model as SemanticModel,
    ops: () => useModelStore.getState() as never,
  },
  {
    name: 'standaloneModelOps (localModel)',
    reset: freshStandaloneFile,
    model: () => getLocalModel(FILE_ID) as SemanticModel,
    ops: () => standaloneModelOps(FILE_ID) as never,
  },
];

describe.each(SURFACES)('A4 traceability cascades — $name', (surface) => {
  beforeEach(() => surface.reset());

  it('setElementMembers clears callsOperationId on the action that called a removed operation', () => {
    const classId = surface.ops().createClass({ name: 'OrderService', attributeIds: [], operationIds: [] } as never);
    surface.ops().setElementMembers(
      classId,
      [] as never,
      [{ id: 'op1', kind: 'OPERATION', name: 'pay' }] as never,
    );

    const activityId = surface.ops().createActivity({ name: 'Checkout' } as never);
    const nodeId = surface.ops().createActivityNode({
      name: 'Pay', activityType: 'CALL_OPERATION', activityId, callsOperationId: 'op1',
    } as never);

    // Editing the member list without `op1` is how a user "deletes" it.
    surface.ops().setElementMembers(classId, [] as never, [] as never);

    expect(surface.model().activityNodes[nodeId].callsOperationId).toBeUndefined();
  });

  it('setElementMembers leaves callsOperationId alone when the operation is only edited, not removed', () => {
    const classId = surface.ops().createClass({ name: 'OrderService', attributeIds: [], operationIds: [] } as never);
    surface.ops().setElementMembers(
      classId,
      [] as never,
      [{ id: 'op1', kind: 'OPERATION', name: 'pay' }] as never,
    );

    const activityId = surface.ops().createActivity({ name: 'Checkout' } as never);
    const nodeId = surface.ops().createActivityNode({
      name: 'Pay', activityType: 'CALL_OPERATION', activityId, callsOperationId: 'op1',
    } as never);

    // Same id, renamed — this is an edit, not a delete (id survives rename).
    surface.ops().setElementMembers(
      classId,
      [] as never,
      [{ id: 'op1', kind: 'OPERATION', name: 'payInFull' }] as never,
    );

    expect(surface.model().activityNodes[nodeId].callsOperationId).toBe('op1');
  });

  it('deleteClass clears representsId on any lane whose responsible class was deleted', () => {
    const classId = surface.ops().createClass({ name: 'Customer', attributeIds: [], operationIds: [] } as never);
    const activityId = surface.ops().createActivity({ name: 'Checkout' } as never);
    const laneId = surface.ops().createActivityPartition({
      name: 'Customer lane', activityId, index: 0, representsId: classId,
    } as never);

    surface.ops().deleteClass(classId);

    expect(surface.model().activityPartitions![laneId].representsId).toBeUndefined();
  });
});
