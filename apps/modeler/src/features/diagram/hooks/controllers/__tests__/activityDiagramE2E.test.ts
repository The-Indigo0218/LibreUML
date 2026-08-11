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
