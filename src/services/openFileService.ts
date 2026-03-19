/**
 * openFileService.ts
 *
 * Unified "Open File" routing for .luml and .xmi archives.
 *
 * ─── .luml routing ────────────────────────────────────────────────────────────
 *
 *   openLumlFile(file, mode) reads the ZIP manifest and branches:
 *
 *   exportType: "project"  → loadParsedProject() — replaces the workspace.
 *                            The chosen mode is ignored; a full project archive
 *                            always loads into a fresh workspace.
 *
 *   exportType: "diagram"  → injectDiagramIntoVFS() — safe injection.
 *                            mode === 'project'    : adds into current project
 *                            mode === 'standalone' : auto-scaffolds if needed
 *
 * ─── .xmi routing ─────────────────────────────────────────────────────────────
 *
 *   injectXmiIntoVFS(content, name, mode) — parses XMI and injects via the
 *   same mode logic as diagram injection.
 *
 * ─── Mode semantics ───────────────────────────────────────────────────────────
 *
 *   'project'    — diagram is placed inside the active project's "diagrams"
 *                  folder.  Throws if no project is loaded.
 *   'standalone' — diagram is added at root (isExternal: true).  If no project
 *                  exists a minimal scaffold is created automatically.
 */

import type {
  RelationKind,
  IRAttribute,
  IROperation,
  ViewNode,
  ViewEdge,
  DiagramView,
  SemanticModel,
  LibreUMLProject,
  VFSFile,
  VFSFolder,
} from '../core/domain/vfs/vfs.types';
import { useModelStore } from '../store/model.store';
import { useVFSStore } from '../store/vfs.store';
import { useWorkspaceStore } from '../store/workspace.store';
import { useToastStore } from '../store/toast.store';
import { XmiImporterService } from './xmiImporter.service';
import { parseLumlFile, loadParsedProject } from './projectIO.service';

// ─── Shared helpers ───────────────────────────────────────────────────────────

export type OpenMode = 'project' | 'standalone';

function mapVisibility(v: string): 'public' | 'private' | 'protected' | 'package' {
  switch (v) {
    case '+': return 'public';
    case '-': return 'private';
    case '#': return 'protected';
    case '~': return 'package';
    default:  return 'public';
  }
}

function mapEdgeTypeToRelationKind(type?: string): RelationKind {
  switch (type?.toLowerCase()) {
    case 'inheritance':    return 'GENERALIZATION';
    case 'implementation': return 'REALIZATION';
    case 'dependency':     return 'DEPENDENCY';
    case 'aggregation':    return 'AGGREGATION';
    case 'composition':    return 'COMPOSITION';
    default:               return 'ASSOCIATION';
  }
}

/** Creates a minimal project scaffold for standalone imports with no active project. */
function scaffoldProject(projectName: string): LibreUMLProject {
  const now = Date.now();
  const modelFileId = crypto.randomUUID();
  const diagramsFolderId = crypto.randomUUID();

  const modelFile: VFSFile = {
    id: modelFileId,
    name: 'domain.model',
    type: 'FILE',
    parentId: null,
    diagramType: 'UNSPECIFIED',
    extension: '.model',
    isExternal: false,
    content: null,
    createdAt: now,
    updatedAt: now,
  };

  const diagramsFolder: VFSFolder = {
    id: diagramsFolderId,
    name: 'diagrams',
    type: 'FOLDER',
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };

  return {
    id: crypto.randomUUID(),
    projectName,
    version: '1.0.0',
    domainModelId: modelFileId,
    nodes: {
      [modelFileId]: modelFile,
      [diagramsFolderId]: diagramsFolder,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Ensures a VFS project and SemanticModel are present.
 * For 'project' mode, throws if no project is loaded.
 * For 'standalone' mode, auto-scaffolds a minimal project if none exists.
 */
function ensureContext(mode: OpenMode, name: string): void {
  const modelStore = useModelStore.getState();

  if (mode === 'project') {
    if (!useVFSStore.getState().project) {
      throw new Error(
        'No active project. Create or open a project first, then use "Add to Project".',
      );
    }
  } else {
    if (!useVFSStore.getState().project) {
      const scaffold = scaffoldProject(name);
      modelStore.initModel(scaffold.domainModelId);
      useVFSStore.getState().loadProject(scaffold);
    }
  }

  if (!modelStore.model) {
    modelStore.initModel(useVFSStore.getState().project!.domainModelId);
  }
}

/** Finds the "diagrams" folder ID in the current project, or null if absent. */
function findDiagramsFolderId(): string | null {
  const project = useVFSStore.getState().project!;
  return (
    Object.values(project.nodes).find(
      (n) => n.type === 'FOLDER' && n.name === 'diagrams',
    )?.id ?? null
  );
}

// ─── .luml routing ────────────────────────────────────────────────────────────

/**
 * Opens a .luml file, routing by its embedded exportType:
 *
 *   "project"  → loads the full workspace (mode is ignored)
 *   "diagram"  → injects the single diagram based on mode
 */
export async function openLumlFile(file: File, mode: OpenMode): Promise<void> {
  const result = await parseLumlFile(file);

  if (result.exportType === 'project') {
    loadParsedProject(result.project, result.model);
  } else {
    await injectDiagramIntoVFS(
      result.view,
      result.partialModel,
      result.name,
      mode,
    );
  }
}

// ─── Diagram injection (from .luml diagram export) ────────────────────────────

/**
 * Injects a pre-parsed DiagramView + partial SemanticModel into the workspace.
 *
 * All element and relation IDs are remapped to fresh UUIDs on import to prevent
 * any collision with elements already present in the target project's model.
 */
export async function injectDiagramIntoVFS(
  view: DiagramView,
  partialModel: SemanticModel,
  name: string,
  mode: OpenMode,
): Promise<void> {
  ensureContext(mode, name);
  const modelStore = useModelStore.getState();

  // ── Remap and create IR elements ───────────────────────────────────────────
  const idMap = new Map<string, string>(); // oldId → newId

  // Classes
  for (const [oldId, cls] of Object.entries(partialModel.classes)) {
    const newAttrs: IRAttribute[] = cls.attributeIds
      .map((id) => partialModel.attributes[id])
      .filter(Boolean)
      .map((a) => ({ ...a, id: crypto.randomUUID() }));

    const newOps: IROperation[] = cls.operationIds
      .map((id) => partialModel.operations[id])
      .filter(Boolean)
      .map((o) => ({
        ...o,
        id: crypto.randomUUID(),
        parameters: o.parameters ?? [],
      }));

    const externalFlag = mode === 'standalone' ? { isExternal: true as const } : {};

    const newId = cls.isAbstract
      ? modelStore.createAbstractClass({
          name: cls.name,
          attributeIds: [],
          operationIds: [],
          visibility: cls.visibility,
          ...externalFlag,
        })
      : modelStore.createClass({
          name: cls.name,
          attributeIds: [],
          operationIds: [],
          visibility: cls.visibility,
          isAbstract: false,
          ...externalFlag,
        });

    modelStore.setElementMembers(newId, newAttrs, newOps);
    idMap.set(oldId, newId);
  }

  // Interfaces
  for (const [oldId, iface] of Object.entries(partialModel.interfaces)) {
    const newOps: IROperation[] = iface.operationIds
      .map((id) => partialModel.operations[id])
      .filter(Boolean)
      .map((o) => ({
        ...o,
        id: crypto.randomUUID(),
        parameters: o.parameters ?? [],
      }));

    const externalFlag = mode === 'standalone' ? { isExternal: true as const } : {};
    const newId = modelStore.createInterface({
      name: iface.name,
      operationIds: [],
      visibility: iface.visibility,
      ...externalFlag,
    });
    modelStore.setElementMembers(newId, [], newOps);
    idMap.set(oldId, newId);
  }

  // Enums
  for (const [oldId, enm] of Object.entries(partialModel.enums)) {
    const externalFlag = mode === 'standalone' ? { isExternal: true as const } : {};
    const newId = modelStore.createEnum({
      name: enm.name,
      literals: [...(enm.literals ?? [])],
      visibility: enm.visibility,
      ...externalFlag,
    });
    idMap.set(oldId, newId);
  }

  // Relations (after all elements so source/target IDs can be remapped)
  const relExternalFlag = mode === 'standalone' ? { isExternal: true as const } : {};
  for (const [oldRelId, rel] of Object.entries(partialModel.relations)) {
    const newSourceId = idMap.get(rel.sourceId);
    const newTargetId = idMap.get(rel.targetId);
    if (!newSourceId || !newTargetId) continue;

    const newRelId = modelStore.createRelation({
      kind: rel.kind,
      sourceId: newSourceId,
      targetId: newTargetId,
      name: rel.name,
      stereotypes: rel.stereotypes,
      ...relExternalFlag,
      ...(rel.sourceEnd || rel.targetEnd
        ? {
            sourceEnd: rel.sourceEnd
              ? { ...rel.sourceEnd, elementId: newSourceId }
              : undefined,
            targetEnd: rel.targetEnd
              ? { ...rel.targetEnd, elementId: newTargetId }
              : undefined,
          }
        : {}),
    });
    idMap.set(oldRelId, newRelId);
  }

  // ── Build new DiagramView with remapped IDs ────────────────────────────────
  const parentId =
    mode === 'project' ? findDiagramsFolderId() : null;

  const fileId = useVFSStore.getState().createFile(
    parentId,
    name,
    'CLASS_DIAGRAM',
    '.luml',
    mode === 'standalone',
  );

  const viewNodes: ViewNode[] = view.nodes
    .filter((n) => idMap.has(n.elementId))
    .map((n) => ({
      ...n,
      id: crypto.randomUUID(),
      elementId: idMap.get(n.elementId)!,
    }));

  const viewEdges: ViewEdge[] = view.edges
    .filter((e) => idMap.has(e.relationId))
    .map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      relationId: idMap.get(e.relationId)!,
    }));

  useVFSStore.getState().updateFileContent(fileId, {
    diagramId: fileId,
    nodes: viewNodes,
    edges: viewEdges,
  });

  useWorkspaceStore.getState().openTab(fileId);

  if (mode === 'standalone') {
    useToastStore.getState().show(`"${name}" opened as standalone`);
  }
}

// ─── XMI injection ────────────────────────────────────────────────────────────

/**
 * Parses XMI content and injects the resulting diagram into the VFS + SemanticModel.
 *
 * 'project' mode — requires an active VFS project.
 *   The new diagram file is placed inside the project's "diagrams" folder.
 *
 * 'standalone' mode — auto-creates a minimal project if none is open.
 *   The new diagram file is added at root with isExternal: true.
 *
 * @throws if 'project' mode is requested but no project is loaded.
 */
export async function injectXmiIntoVFS(
  xmiContent: string,
  fileName: string,
  mode: OpenMode,
): Promise<void> {
  ensureContext(mode, fileName);
  const modelStore = useModelStore.getState();

  // ── Parse XMI ──────────────────────────────────────────────────────────────
  const { nodes, edges } = XmiImporterService.import(xmiContent);

  // ── Map XMI nodes → IR elements ────────────────────────────────────────────
  const idMap = new Map<string, string>();
  const externalFlag = mode === 'standalone' ? { isExternal: true as const } : {};

  for (const node of nodes) {
    const { label, attributes, methods, stereotype } = node.data;

    const irAttrs: IRAttribute[] = attributes.map((a) => ({
      id: crypto.randomUUID(),
      kind: 'ATTRIBUTE' as const,
      name: a.name,
      type: a.type,
      visibility: mapVisibility(a.visibility),
      multiplicity: a.isArray ? '0..*' : undefined,
    }));

    const irOps: IROperation[] = methods.map((m) => ({
      id: crypto.randomUUID(),
      kind: 'OPERATION' as const,
      name: m.name,
      returnType: m.returnType || 'void',
      visibility: mapVisibility(m.visibility),
      parameters: m.parameters.map((p) => ({ name: p.name, type: p.type })),
      isStatic: m.isStatic ?? false,
    }));

    let elementId: string;

    if (stereotype === 'interface') {
      elementId = modelStore.createInterface({
        name: label,
        operationIds: [],
        visibility: 'public',
        ...externalFlag,
      });
      modelStore.setElementMembers(elementId, [], irOps);
    } else if (stereotype === 'enum') {
      elementId = modelStore.createEnum({
        name: label,
        literals: attributes.map((a) => ({ name: a.name })),
        visibility: 'public',
        ...externalFlag,
      });
    } else if (stereotype === 'abstract') {
      elementId = modelStore.createAbstractClass({
        name: label,
        attributeIds: [],
        operationIds: [],
        visibility: 'public',
        ...externalFlag,
      });
      modelStore.setElementMembers(elementId, irAttrs, irOps);
    } else {
      elementId = modelStore.createClass({
        name: label,
        attributeIds: [],
        operationIds: [],
        visibility: 'public',
        ...externalFlag,
      });
      modelStore.setElementMembers(elementId, irAttrs, irOps);
    }

    idMap.set(node.id, elementId);
  }

  // ── Map XMI edges → IR relations ───────────────────────────────────────────
  for (const edge of edges) {
    const sourceId = idMap.get(edge.source);
    const targetId = idMap.get(edge.target);
    if (!sourceId || !targetId) continue;

    const kind = mapEdgeTypeToRelationKind(edge.data?.type ?? edge.type);
    const hasMultiplicity =
      edge.data?.sourceMultiplicity || edge.data?.targetMultiplicity;

    const relationId = modelStore.createRelation({
      kind,
      sourceId,
      targetId,
      ...externalFlag,
      ...(hasMultiplicity
        ? {
            sourceEnd: {
              elementId: sourceId,
              multiplicity: edge.data?.sourceMultiplicity,
            },
            targetEnd: {
              elementId: targetId,
              multiplicity: edge.data?.targetMultiplicity,
            },
          }
        : {}),
    });

    idMap.set(edge.id, relationId);
  }

  // ── Create VFS file + DiagramView ──────────────────────────────────────────
  const parentId =
    mode === 'project' ? findDiagramsFolderId() : null;

  const fileId = useVFSStore.getState().createFile(
    parentId,
    fileName,
    'CLASS_DIAGRAM',
    '.luml',
    mode === 'standalone',
  );

  const viewNodes: ViewNode[] = nodes
    .filter((n) => idMap.has(n.id))
    .map((n) => ({
      id: crypto.randomUUID(),
      elementId: idMap.get(n.id)!,
      x: n.position.x,
      y: n.position.y,
    }));

  const viewEdges: ViewEdge[] = edges
    .filter((e) => idMap.has(e.id))
    .map((e) => ({
      id: crypto.randomUUID(),
      relationId: idMap.get(e.id)!,
      waypoints: [],
      sourceMultiplicity: e.data?.sourceMultiplicity,
      targetMultiplicity: e.data?.targetMultiplicity,
    }));

  useVFSStore.getState().updateFileContent(fileId, {
    diagramId: fileId,
    nodes: viewNodes,
    edges: viewEdges,
  });

  useWorkspaceStore.getState().openTab(fileId);

  if (mode === 'standalone') {
    useToastStore.getState().show(`"${fileName}" imported as standalone`);
  }
}
