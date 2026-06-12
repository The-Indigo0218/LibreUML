import { describe, it, expect } from 'vitest';
import { buildVfsSnapshot } from '../services/vfsSnapshot';
import { reconstructProject } from '../services/reconstructProject';
import type {
  SemanticModel,
  LibreUMLProject,
  VFSFile,
  DiagramView,
} from '../../../core/domain/vfs/vfs.types';
import type { ProjectFullResponse } from '../../../api/types';

/**
 * P4 stage C — the new free anchors (sourceAnchor/targetAnchor on ViewEdge)
 * must survive the cloud round-trip. The pipeline passes `content` through
 * structurally (viewData = {...content} → reconstruct content: viewData), so
 * no field-mapping change was needed — this test guards that.
 */

const jt = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function baseModel(): SemanticModel {
  return {
    id: 'm', name: 'M', version: '1',
    packages: {}, classes: { A: { id: 'A', name: 'A', kind: 'CLASS', isAbstract: false, attributeIds: [], operationIds: [] },
                             B: { id: 'B', name: 'B', kind: 'CLASS', isAbstract: false, attributeIds: [], operationIds: [] } },
    interfaces: {}, enums: {}, dataTypes: {}, attributes: {}, operations: {},
    actors: {}, useCases: {}, activityNodes: {}, objectInstances: {}, components: {},
    nodes: {}, artifacts: {}, lifelines: {}, messages: {},
    relations: { r1: { id: 'r1', kind: 'ASSOCIATION', sourceId: 'A', targetId: 'B' } },
    createdAt: 1, updatedAt: 1,
  } as SemanticModel;
}

function viewWithAnchoredEdge(diagramId: string): DiagramView {
  return {
    diagramId,
    nodes: [
      { id: 'vnA', elementId: 'A', x: 0, y: 0 },
      { id: 'vnB', elementId: 'B', x: 300, y: 200 },
    ],
    edges: [
      {
        id: 've', relationId: 'r1', waypoints: [], routingMode: 'straight',
        sourceAnchor: { nx: 0.3, ny: 0 },
        targetAnchor: { nx: 1, ny: 0.65 },
      },
    ],
  } as DiagramView;
}

function makeProject(): LibreUMLProject {
  const file: VFSFile = {
    id: 'f1', name: 'Class.luml', type: 'FILE', parentId: null,
    diagramType: 'CLASS_DIAGRAM', extension: '.luml', isExternal: false,
    standalone: true, localModel: baseModel(),
    content: viewWithAnchoredEdge('f1'), createdAt: 1, updatedAt: 1,
  };
  return {
    id: 'p1', projectName: 'P', version: '1.0.0', domainModelId: 'dm',
    nodes: { f1: file }, createdAt: 1, updatedAt: 1,
  } as LibreUMLProject;
}

function simulateCloudRoundTrip(project: LibreUMLProject): ProjectFullResponse {
  const vfsSnapshot = jt(buildVfsSnapshot(project));
  const diagrams = Object.values(project.nodes)
    .filter((n): n is VFSFile => n.type === 'FILE')
    .map((file) => ({
      id: `cloud-${file.id}`, projectId: 'p1', name: file.name,
      diagramType: 'CLASS' as const, path: file.id,
      viewData: jt({
        ...(file.content ?? { nodes: [], edges: [] }),
        ...(file.standalone && file.localModel ? { _localModel: file.localModel } : {}),
      } as Record<string, unknown>),
      version: 1, createdAt: '2026-06-11T00:00:00Z', updatedAt: '2026-06-11T00:00:00Z',
    }));
  return {
    project: {
      id: 'p1', name: project.projectName, projectVersion: project.version,
      visibility: 'PRIVATE', version: 1, vfsSnapshot, diagrams: [],
      createdAt: '2026-06-11T00:00:00Z', updatedAt: '2026-06-11T00:00:00Z',
    },
    model: { id: 'mdl', projectId: 'p1', data: jt(baseModel() as unknown as Record<string, unknown>), version: 1, updatedAt: '2026-06-11T00:00:00Z' },
    diagrams,
  } as unknown as ProjectFullResponse;
}

describe('P4 free anchors — cloud round-trip', () => {
  it('preserves sourceAnchor/targetAnchor through serialize → reconstruct', () => {
    const rebuilt = reconstructProject(simulateCloudRoundTrip(makeProject()));
    expect(rebuilt).not.toBeNull();
    const content = (rebuilt!.nodes['f1'] as VFSFile).content as DiagramView;
    const edge = content.edges.find((e) => e.id === 've')!;
    expect(edge.sourceAnchor).toEqual({ nx: 0.3, ny: 0 });
    expect(edge.targetAnchor).toEqual({ nx: 1, ny: 0.65 });
  });
});
