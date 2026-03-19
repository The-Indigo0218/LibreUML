/**
 * projectIO.service.ts
 *
 * Serialization / deserialization engine for LibreUML native project files (.luml).
 *
 * A .luml file is always a ZIP archive.  Two payload variants are now supported,
 * distinguished by the "exportType" field in project.json:
 *
 *   exportType: "project"  (or absent for legacy files)
 *   ──────────────────────────────────────────────────────────────────────────
 *   Full workspace snapshot.  Includes the entire VFS tree, the complete
 *   SemanticModel, and every diagram's DiagramView.  Loading this replaces
 *   the current workspace.
 *
 *   ┌─ my_project.luml (ZIP) ──────────────────────────────────────────┐
 *   │  project.json     VFS metadata + full node tree (content: null)  │
 *   │  domain.model     Full SemanticModel JSON                        │
 *   │  diagrams/                                                        │
 *   │    <fileId>.json  DiagramView per diagram file                   │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 *   exportType: "diagram"
 *   ──────────────────────────────────────────────────────────────────────
 *   Single-diagram export.  Contains only the elements referenced by one
 *   diagram — does NOT replace the workspace.  The user chooses whether to
 *   inject it into an existing project or open it as a standalone file.
 *
 *   ┌─ my_diagram.luml (ZIP) ──────────────────────────────────────────┐
 *   │  project.json     { exportType, diagramId, diagramName, …}       │
 *   │  domain.model     Partial SemanticModel (referenced elements only)│
 *   │  diagrams/                                                        │
 *   │    <diagramId>.json  DiagramView for this diagram                 │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * ─── Hydration order (critical for project imports) ──────────────────────────
 *   1. closeAllFiles()  — wipes stale tab IDs before any re-render
 *   2. loadModel()      — semantic data ready before canvas mounts
 *   3. loadProject()    — triggers React re-render into clean state
 */

import JSZip from 'jszip';
import { useVFSStore } from '../store/vfs.store';
import { useModelStore } from '../store/model.store';
import { useWorkspaceStore } from '../store/workspace.store';
import type {
  LibreUMLProject,
  VFSFile,
  VFSFolder,
  SemanticModel,
  DiagramView,
} from '../core/domain/vfs/vfs.types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const LUML_FORMAT_VERSION = '2.0' as const;

const ZIP_PROJECT_JSON = 'project.json';
const ZIP_DOMAIN_MODEL = 'domain.model';
const ZIP_DIAGRAMS_DIR = 'diagrams/';

// ─── Types ────────────────────────────────────────────────────────────────────

/** project.json shape inside a full-project archive. */
export interface LumlProjectManifest extends LibreUMLProject {
  _lumlVersion: string;
  /** Absent on legacy files — treated as 'project'. */
  exportType?: 'project' | 'diagram';
}

/** project.json shape inside a single-diagram archive. */
export interface LumlDiagramManifest {
  _lumlVersion: string;
  exportType: 'diagram';
  diagramId: string;
  diagramName: string;
}

/** Discriminated union returned by parseLumlFile(). */
export type LumlParseResult =
  | { exportType: 'project'; project: LibreUMLProject; model: SemanticModel | null }
  | {
      exportType: 'diagram';
      view: DiagramView;
      partialModel: SemanticModel;
      name: string;
    };

/** Thrown when .luml import validation fails.  Message is user-facing. */
export class ProjectImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectImportError';
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toSlug(name: string, fallback: string): string {
  return (
    name
      .trim()
      .replace(/[^a-z0-9_-]/gi, '_')
      .replace(/_+/g, '_')
      .toLowerCase() || fallback
  );
}

function emptySemanticModel(id?: string): SemanticModel {
  const now = Date.now();
  return {
    id: id ?? crypto.randomUUID(),
    name: 'Diagram Snapshot',
    version: '1.0.0',
    packages: {},
    classes: {},
    interfaces: {},
    enums: {},
    dataTypes: {},
    attributes: {},
    operations: {},
    actors: {},
    useCases: {},
    activityNodes: {},
    objectInstances: {},
    components: {},
    nodes: {},
    artifacts: {},
    relations: {},
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Parse ────────────────────────────────────────────────────────────────────

/**
 * Opens a .luml ZIP archive, validates its contents, and returns a
 * LumlParseResult without touching any Zustand stores.
 *
 * Callers decide what to do with the result:
 *   exportType === 'project'  → call loadParsedProject()
 *   exportType === 'diagram'  → call injectDiagramIntoVFS() in openFileService
 */
export async function parseLumlFile(file: File): Promise<LumlParseResult> {
  // ── 1. Open ZIP ─────────────────────────────────────────────────────────────
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new ProjectImportError(
      'Invalid file: could not open as a ZIP archive. ' +
        'The file may be corrupted or was saved by an older version of LibreUML.',
    );
  }

  // ── 2. Read project.json ────────────────────────────────────────────────────
  const projectEntry = zip.file(ZIP_PROJECT_JSON);
  if (!projectEntry) {
    throw new ProjectImportError(
      `Invalid file: "${ZIP_PROJECT_JSON}" is missing from the archive. ` +
        'This does not appear to be a LibreUML file.',
    );
  }

  let rawManifest: Record<string, unknown>;
  try {
    rawManifest = JSON.parse(await projectEntry.async('string'));
  } catch {
    throw new ProjectImportError(
      `"${ZIP_PROJECT_JSON}" contains invalid JSON. The file is corrupted.`,
    );
  }

  // ── 3. Route by exportType ──────────────────────────────────────────────────
  const exportType = rawManifest.exportType as string | undefined;

  if (exportType === 'diagram') {
    return parseDiagramPayload(zip, rawManifest);
  } else {
    // absent (legacy) or explicitly 'project'
    return parseProjectPayload(zip, rawManifest);
  }
}

async function parseDiagramPayload(
  zip: JSZip,
  raw: Record<string, unknown>,
): Promise<LumlParseResult & { exportType: 'diagram' }> {
  const diagramId = raw.diagramId as string | undefined;
  const diagramName = raw.diagramName as string | undefined;

  if (!diagramId || typeof diagramId !== 'string') {
    throw new ProjectImportError('Invalid diagram file: "diagramId" is missing.');
  }
  if (!diagramName || typeof diagramName !== 'string') {
    throw new ProjectImportError('Invalid diagram file: "diagramName" is missing.');
  }

  // domain.model — partial SemanticModel
  const modelEntry = zip.file(ZIP_DOMAIN_MODEL);
  if (!modelEntry) {
    throw new ProjectImportError(
      `Invalid diagram file: "${ZIP_DOMAIN_MODEL}" is missing.`,
    );
  }
  let partialModel: SemanticModel;
  try {
    partialModel = JSON.parse(await modelEntry.async('string')) as SemanticModel;
  } catch {
    throw new ProjectImportError(
      `"${ZIP_DOMAIN_MODEL}" contains invalid JSON.`,
    );
  }

  // diagrams/{diagramId}.json — DiagramView
  const diagramEntry = zip.file(`${ZIP_DIAGRAMS_DIR}${diagramId}.json`);
  if (!diagramEntry) {
    throw new ProjectImportError(
      `Invalid diagram file: "diagrams/${diagramId}.json" is missing.`,
    );
  }
  let view: DiagramView;
  try {
    view = JSON.parse(await diagramEntry.async('string')) as DiagramView;
  } catch {
    throw new ProjectImportError(
      `Diagram view "diagrams/${diagramId}.json" contains invalid JSON.`,
    );
  }

  return { exportType: 'diagram', view, partialModel, name: diagramName };
}

async function parseProjectPayload(
  zip: JSZip,
  raw: Record<string, unknown>,
): Promise<LumlParseResult & { exportType: 'project' }> {
  const manifest = raw as LumlProjectManifest;

  // Validate required project fields
  if (typeof manifest.projectName !== 'string' || !manifest.projectName.trim()) {
    throw new ProjectImportError(
      'Invalid project: projectName is missing or empty.',
    );
  }
  if (typeof manifest.domainModelId !== 'string' || !manifest.domainModelId) {
    throw new ProjectImportError(
      'Invalid project: domainModelId is missing or empty.',
    );
  }
  if (typeof manifest.nodes !== 'object' || manifest.nodes === null) {
    throw new ProjectImportError(
      `Invalid project: nodes dictionary is missing from "${ZIP_PROJECT_JSON}".`,
    );
  }

  // domain.model gate
  const domainModelNode = manifest.nodes[manifest.domainModelId];
  if (!domainModelNode) {
    throw new ProjectImportError(
      `Invalid project: node referenced by domainModelId ` +
        `("${manifest.domainModelId}") is not present in the nodes dictionary.`,
    );
  }
  if (domainModelNode.type !== 'FILE') {
    throw new ProjectImportError(
      'Invalid project: the domain model entry is not a FILE node.',
    );
  }
  if ((domainModelNode as VFSFile).extension !== '.model') {
    throw new ProjectImportError(
      `Invalid project: the domain model entry has extension ` +
        `"${(domainModelNode as VFSFile).extension}" instead of ".model".`,
    );
  }

  // domain.model — full SemanticModel
  const modelEntry = zip.file(ZIP_DOMAIN_MODEL);
  if (!modelEntry) {
    throw new ProjectImportError(
      `Invalid file: "${ZIP_DOMAIN_MODEL}" is missing from the archive.`,
    );
  }
  let model: SemanticModel | null;
  try {
    const raw = JSON.parse(await modelEntry.async('string'));
    model =
      typeof raw === 'object' && raw !== null ? (raw as SemanticModel) : null;
  } catch {
    throw new ProjectImportError(
      `"${ZIP_DOMAIN_MODEL}" contains invalid JSON. The semantic model data is corrupted.`,
    );
  }

  // Reconstruct nodes — merge DiagramView content from diagrams/
  const nodes: Record<string, VFSFolder | VFSFile> = { ...manifest.nodes };
  const diagramEntries = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.startsWith(ZIP_DIAGRAMS_DIR),
  );

  await Promise.all(
    diagramEntries.map(async (entry) => {
      const fileId = entry.name
        .slice(ZIP_DIAGRAMS_DIR.length)
        .replace(/\.json$/, '');
      if (!fileId || !nodes[fileId]) return;

      try {
        const content = JSON.parse(
          await entry.async('string'),
        ) as DiagramView | null;
        nodes[fileId] = { ...(nodes[fileId] as VFSFile), content };
      } catch {
        console.warn(
          `[LibreUML] Could not parse diagram "${fileId}" — content will be empty.`,
        );
      }
    }),
  );

  const project: LibreUMLProject = { ...manifest, nodes };
  return { exportType: 'project', project, model };
}

// ─── Store hydration ──────────────────────────────────────────────────────────

/**
 * Rehydrates all three stores with a pre-parsed project result.
 * Order is critical — see module header.
 */
export function loadParsedProject(
  project: LibreUMLProject,
  model: SemanticModel | null,
): void {
  useWorkspaceStore.getState().closeAllFiles();
  if (model !== null) {
    useModelStore.getState().loadModel(model);
  } else {
    useModelStore.getState().initModel(project.domainModelId);
  }
  useVFSStore.getState().loadProject(project);
}

// ─── High-level import (backward-compatible) ──────────────────────────────────

/**
 * Reads a .luml project archive and fully rehydrates the workspace.
 * Throws ProjectImportError if the file is a single-diagram export rather
 * than a full project — use openLumlFile() in openFileService for smart routing.
 */
export async function importProject(file: File): Promise<LibreUMLProject> {
  const result = await parseLumlFile(file);

  if (result.exportType !== 'project') {
    throw new ProjectImportError(
      'This file is a single-diagram export, not a full project archive. ' +
        'Use "Open File…" to import it into your workspace.',
    );
  }

  loadParsedProject(result.project, result.model);
  return result.project;
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Exports the entire active workspace as a .luml project archive.
 * Sets exportType: "project" in the manifest.
 */
export async function downloadProject(): Promise<void> {
  const project = useVFSStore.getState().project;
  const model = useModelStore.getState().model;

  if (!project) {
    throw new Error(
      'No active project to export. Please open or create a project first.',
    );
  }

  const zip = new JSZip();

  // project.json — strip DiagramView content from FILE nodes
  const nodesStripped: Record<string, VFSFolder | VFSFile> = {};
  for (const [id, node] of Object.entries(project.nodes)) {
    nodesStripped[id] =
      node.type === 'FILE' ? { ...(node as VFSFile), content: null } : node;
  }

  const manifest: LumlProjectManifest = {
    ...project,
    _lumlVersion: LUML_FORMAT_VERSION,
    exportType: 'project',
    nodes: nodesStripped,
  };
  zip.file(ZIP_PROJECT_JSON, JSON.stringify(manifest, null, 2));

  // domain.model — full SemanticModel
  zip.file(ZIP_DOMAIN_MODEL, JSON.stringify(model ?? null, null, 2));

  // diagrams/{fileId}.json — DiagramView per diagram file
  const diagramsFolder = zip.folder('diagrams')!;
  for (const node of Object.values(project.nodes)) {
    if (node.type === 'FILE' && (node as VFSFile).extension !== '.model') {
      const f = node as VFSFile;
      diagramsFolder.file(
        `${f.id}.json`,
        JSON.stringify(f.content ?? null, null, 2),
      );
    }
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  triggerDownload(blob, `${toSlug(project.projectName, 'project')}.luml`);
}

/**
 * Exports just the active diagram as a standalone .luml file.
 * Sets exportType: "diagram" and bundles only the semantic elements
 * referenced by that diagram — does NOT include the rest of the workspace.
 */
export async function exportDiagram(fileId: string): Promise<void> {
  const project = useVFSStore.getState().project;
  const model = useModelStore.getState().model;

  if (!project) {
    throw new Error('No active project. Please open a project first.');
  }

  const fileNode = project.nodes[fileId];
  if (!fileNode || fileNode.type !== 'FILE') {
    throw new Error('The selected entry is not a valid diagram file.');
  }

  const vfsFile = fileNode as VFSFile;
  const view = vfsFile.content as DiagramView | null;
  if (!view || !Array.isArray(view.nodes)) {
    throw new Error('The selected diagram has no renderable content yet.');
  }

  const diagramName = vfsFile.name.replace(/\.[^/.]+$/, '');

  // ── Build partial SemanticModel (only elements used by this diagram) ────────
  const elementIds = new Set(view.nodes.map((n) => n.elementId));
  const relationIds = new Set(view.edges.map((e) => e.relationId));
  const partialModel = emptySemanticModel(model?.id);

  if (model) {
    for (const elementId of elementIds) {
      if (model.classes[elementId]) {
        const cls = model.classes[elementId];
        partialModel.classes[elementId] = cls;
        cls.attributeIds.forEach((id) => {
          if (model.attributes[id]) partialModel.attributes[id] = model.attributes[id];
        });
        cls.operationIds.forEach((id) => {
          if (model.operations[id]) partialModel.operations[id] = model.operations[id];
        });
      } else if (model.interfaces[elementId]) {
        const iface = model.interfaces[elementId];
        partialModel.interfaces[elementId] = iface;
        iface.operationIds.forEach((id) => {
          if (model.operations[id]) partialModel.operations[id] = model.operations[id];
        });
      } else if (model.enums[elementId]) {
        partialModel.enums[elementId] = model.enums[elementId];
      }
    }

    for (const relationId of relationIds) {
      if (model.relations[relationId]) {
        partialModel.relations[relationId] = model.relations[relationId];
      }
    }
  }

  // ── Build ZIP ────────────────────────────────────────────────────────────────
  const zip = new JSZip();

  const manifest: LumlDiagramManifest = {
    _lumlVersion: LUML_FORMAT_VERSION,
    exportType: 'diagram',
    diagramId: fileId,
    diagramName,
  };
  zip.file(ZIP_PROJECT_JSON, JSON.stringify(manifest, null, 2));
  zip.file(ZIP_DOMAIN_MODEL, JSON.stringify(partialModel, null, 2));

  const diagramsFolder = zip.folder('diagrams')!;
  diagramsFolder.file(`${fileId}.json`, JSON.stringify(view, null, 2));

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  triggerDownload(blob, `${toSlug(diagramName, 'diagram')}.luml`);
}
