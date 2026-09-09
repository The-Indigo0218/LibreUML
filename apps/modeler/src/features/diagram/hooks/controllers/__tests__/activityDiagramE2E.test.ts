import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVFSStore } from '../../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel, ensureLocalModel } from '../../../../../store/standaloneModelOps';
import { buildActivityDiagramNodes } from '../activityDiagramNodes';
import { migrateModel } from '../../../../../store/migrations/schema';
import type {
  LibreUMLProject,
  DiagramView,
  VFSFile,
} from '../../../../../core/domain/vfs/vfs.types';
import {
  isActivityActionViewModel,
  isActivityControlNodeViewModel,
} from '../../../../../adapters/view-models/node.view-model';

const FILE_ID = 'activity-file';

function freshProject(): void {
  const now = Date.now();
  useVFSStore.getState().loadProject({
    id: 'proj', projectName: 'P', version: '1.0.0', domainModelId: 'dm',
    nodes: {
      [FILE_ID]: {
        id: FILE_ID, name: 'Flow.luml', type: 'FILE', parentId: null,
        diagramType: 'ACTIVITY_DIAGRAM', extension: '.luml',
        isExternal: false, standalone: true,
        content: { diagramId: FILE_ID, nodes: [], edges: [] },
        createdAt: now, updatedAt: now,
      } as never,
    },
    createdAt: now, updatedAt: now,
  } as never);
  ensureLocalModel(FILE_ID);
}

function file(): VFSFile {
  return useVFSStore.getState().project!.nodes[FILE_ID] as VFSFile;
}

function build() {
  return buildActivityDiagramNodes({
    diagramView: file().content as DiagramView,
    model: getLocalModel(FILE_ID)!,
    isStandalone: true,
    activeTabId: FILE_ID,
    handleNoteUpdate: vi.fn(),
  });
}

/** initial → action → final, the smallest complete flow. */
function seedLinearFlow() {
  const ops = standaloneModelOps(FILE_ID);
  const activityId = ops.createActivity({ name: 'Checkout' } as never);
  const initial = ops.createActivityNode({ activityType: 'INITIAL', activityId, name: '' } as never);
  const action = ops.createActivityNode({
    activityType: 'ACTION', activityId, name: 'Validate cart',
  } as never);
  const final = ops.createActivityNode({
    activityType: 'ACTIVITY_FINAL', activityId, name: '',
  } as never);

  const f1 = ops.createRelation({ kind: 'CONTROL_FLOW', sourceId: initial, targetId: action } as never);
  const f2 = ops.createRelation({ kind: 'CONTROL_FLOW', sourceId: action, targetId: final } as never);

  useVFSStore.getState().updateFileContent(FILE_ID, {
    diagramId: FILE_ID,
    nodes: [
      { id: 'vn-i', elementId: initial, x: 100, y: 40 },
      { id: 'vn-a', elementId: action, x: 80, y: 140 },
      { id: 'vn-f', elementId: final, x: 100, y: 260 },
    ],
    edges: [
      { id: 've-1', relationId: f1, waypoints: [] },
      { id: 've-2', relationId: f2, waypoints: [] },
    ],
  } as never);

  return { activityId, initial, action, final };
}

describe('activity diagram — store → builder → persist → reload', () => {
  beforeEach(freshProject);

  it('builds a linear flow from the store', () => {
    seedLinearFlow();
    const built = build();

    expect(built).toHaveLength(3);
    expect(built.filter((b) => isActivityControlNodeViewModel(b.data as never))).toHaveLength(2);

    const action = built.find((b) => isActivityActionViewModel(b.data as never));
    expect((action!.data as { label: string }).label).toBe('Validate cart');
  });

  it('keeps the two control flows in the model', () => {
    seedLinearFlow();
    const relations = Object.values(getLocalModel(FILE_ID)!.relations);

    expect(relations).toHaveLength(2);
    expect(relations.every((r) => r.kind === 'CONTROL_FLOW')).toBe(true);
  });

  it('survives a save/reload round-trip through the project JSON', () => {
    const { action } = seedLinearFlow();

    // What persistence actually does: serialise the project and load it back.
    const serialised = JSON.parse(JSON.stringify(useVFSStore.getState().project)) as LibreUMLProject;
    useVFSStore.getState().closeProject();
    useVFSStore.getState().loadProject(serialised);

    const model = getLocalModel(FILE_ID)!;
    expect(Object.keys(model.activities!)).toHaveLength(1);
    expect(Object.keys(model.activityNodes)).toHaveLength(3);
    expect(model.activityNodes[action].name).toBe('Validate cart');
    expect(Object.values(model.relations).every((r) => r.kind === 'CONTROL_FLOW')).toBe(true);

    // And the canvas rebuilds the same three nodes from the reloaded state.
    expect(build()).toHaveLength(3);
  });

  it('A3 — a partition, its width, and a node\'s membership all survive a round-trip', () => {
    const { activityId, action } = seedLinearFlow();
    const ops = standaloneModelOps(FILE_ID);
    const laneId = ops.createActivityPartition({ activityId, name: 'Frontline', index: 0 } as never);
    ops.updateActivityNode(action, { partitionId: laneId } as never);

    useVFSStore.getState().updateFileContent(FILE_ID, {
      ...(file().content as DiagramView),
      nodes: [
        { id: 'vn-lane', elementId: laneId, x: 0, y: 0, width: 260 },
        ...(file().content as DiagramView).nodes.map((n) =>
          n.elementId === action ? { ...n, parentPackageId: 'vn-lane' } : n,
        ),
      ],
    } as never);

    const serialised = JSON.parse(JSON.stringify(useVFSStore.getState().project)) as LibreUMLProject;
    useVFSStore.getState().closeProject();
    useVFSStore.getState().loadProject(serialised);

    const model = getLocalModel(FILE_ID)!;
    expect(model.activityPartitions![laneId]).toMatchObject({ name: 'Frontline', index: 0 });
    expect(model.activityNodes[action].partitionId).toBe(laneId);
    const laneVN = (file().content as DiagramView).nodes.find((n) => n.elementId === laneId)!;
    expect(laneVN.width).toBe(260);
    const actionVN = (file().content as DiagramView).nodes.find((n) => n.elementId === action)!;
    expect(actionVN.parentPackageId).toBe('vn-lane');

    // And the canvas rebuilds the lane alongside the three flow nodes.
    expect(build()).toHaveLength(4);
  });

  it('v1.1 — an interruptible region, an interrupting flow, and an exception handler all survive a round-trip', () => {
    const { action, final } = seedLinearFlow();
    const ops = standaloneModelOps(FILE_ID);
    const activityId = Object.values(getLocalModel(FILE_ID)!.activities!)[0].id;
    const region = ops.createActivityNode({
      activityType: 'INTERRUPTIBLE_REGION', activityId, name: 'Checkout region',
    } as never);
    ops.updateActivityNode(action, { containerId: region } as never);
    const interrupting = ops.createRelation({
      kind: 'CONTROL_FLOW', sourceId: action, targetId: final, isInterrupting: true,
    } as never);
    const handler = ops.createActivityNode({ activityType: 'ACTION', activityId, name: 'Handle failure' } as never);
    const handlerRel = ops.createRelation({ kind: 'EXCEPTION_HANDLER', sourceId: action, targetId: handler } as never);

    useVFSStore.getState().updateFileContent(FILE_ID, {
      ...(file().content as DiagramView),
      nodes: [
        ...(file().content as DiagramView).nodes,
        { id: 'vn-region', elementId: region, x: 0, y: 0 },
        { id: 'vn-handler', elementId: handler, x: 400, y: 400 },
      ],
    } as never);

    const serialised = JSON.parse(JSON.stringify(useVFSStore.getState().project)) as LibreUMLProject;
    useVFSStore.getState().closeProject();
    useVFSStore.getState().loadProject(serialised);

    const model = getLocalModel(FILE_ID)!;
    expect(model.activityNodes[region].activityType).toBe('INTERRUPTIBLE_REGION');
    expect(model.activityNodes[action].containerId).toBe(region);
    expect(model.relations[interrupting]).toMatchObject({ kind: 'CONTROL_FLOW', isInterrupting: true });
    expect(model.relations[handlerRel]).toMatchObject({ kind: 'EXCEPTION_HANDLER', sourceId: action, targetId: handler });

    // And the canvas rebuilds the region + handler alongside the linear flow.
    expect(build()).toHaveLength(5);
  });

  it('v1.1 — an expansion region, its mode, and its owned expansion nodes all survive a round-trip', () => {
    seedLinearFlow();
    const ops = standaloneModelOps(FILE_ID);
    const activityId = Object.values(getLocalModel(FILE_ID)!.activities!)[0].id;
    const region = ops.createActivityNode({
      activityType: 'EXPANSION_REGION', activityId, name: 'Per item', mode: 'ITERATIVE',
    } as never);
    // Classifier trace target, same store op the class diagram itself uses —
    // the model is immer-frozen once loaded, so it cannot be written to directly.
    const classId = ops.createClass({ name: 'Item', attributeIds: [], operationIds: [] } as never);
    const inputNode = ops.createActivityNode({
      activityType: 'INPUT_EXPANSION_NODE', activityId, name: '', ownerRegionId: region, classifierId: classId,
    } as never);
    const outputNode = ops.createActivityNode({
      activityType: 'OUTPUT_EXPANSION_NODE', activityId, name: '', ownerRegionId: region,
    } as never);

    useVFSStore.getState().updateFileContent(FILE_ID, {
      ...(file().content as DiagramView),
      nodes: [
        ...(file().content as DiagramView).nodes,
        { id: 'vn-region', elementId: region, x: 0, y: 0, width: 320, height: 220 },
        { id: 'vn-ein', elementId: inputNode, x: -36, y: 10 },
        { id: 'vn-eout', elementId: outputNode, x: 340, y: 10 },
      ],
    } as never);

    const serialised = JSON.parse(JSON.stringify(useVFSStore.getState().project)) as LibreUMLProject;
    useVFSStore.getState().closeProject();
    useVFSStore.getState().loadProject(serialised);

    const model = getLocalModel(FILE_ID)!;
    expect(model.activityNodes[region]).toMatchObject({ activityType: 'EXPANSION_REGION', mode: 'ITERATIVE' });
    expect(model.activityNodes[inputNode]).toMatchObject({
      activityType: 'INPUT_EXPANSION_NODE', ownerRegionId: region, classifierId: classId,
    });
    expect(model.activityNodes[outputNode]).toMatchObject({
      activityType: 'OUTPUT_EXPANSION_NODE', ownerRegionId: region,
    });

    // And the canvas rebuilds the region + both expansion nodes alongside the linear flow.
    expect(build()).toHaveLength(6);
  });

  it('stamps the schema version on reload so the file is not migrated twice', () => {
    seedLinearFlow();
    const serialised = JSON.parse(JSON.stringify(useVFSStore.getState().project)) as LibreUMLProject;
    useVFSStore.getState().closeProject();
    useVFSStore.getState().loadProject(serialised);

    const model = getLocalModel(FILE_ID)!;
    expect(model.schemaVersion).toBeGreaterThan(0);

    const before = JSON.stringify(model);
    migrateModel(model);
    expect(JSON.stringify(model)).toBe(before);
  });

  it('drops a node from the canvas when its element is deleted', () => {
    const { action } = seedLinearFlow();

    standaloneModelOps(FILE_ID).deleteActivityNode(action);

    // The ViewNode is still in the diagram; the builder omits it rather than
    // drawing a placeholder for something that no longer exists.
    expect((file().content as DiagramView).nodes).toHaveLength(3);
    expect(build()).toHaveLength(2);
  });

  it('takes the flows with the node when it is deleted', () => {
    const { action } = seedLinearFlow();

    standaloneModelOps(FILE_ID).deleteActivityNode(action);

    expect(Object.values(getLocalModel(FILE_ID)!.relations)).toHaveLength(0);
  });

  it('empties the diagram when the whole activity is deleted', () => {
    const { activityId } = seedLinearFlow();

    standaloneModelOps(FILE_ID).deleteActivity(activityId);

    const model = getLocalModel(FILE_ID)!;
    expect(Object.keys(model.activityNodes)).toHaveLength(0);
    expect(Object.keys(model.relations)).toHaveLength(0);
    expect(build()).toHaveLength(0);
  });
});
