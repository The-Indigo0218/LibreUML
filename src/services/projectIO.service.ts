/**
 * projectIO.service.ts
 *
 * Serialization/Deserialization engine for LibreUML native project files (.luml).
 *
 * A .luml file is a ZIP archive (not a flat JSON blob).  The archive bundles
 * all layers of project state as individual, human-inspectable files:
 *
 * ┌─ my_project.luml (ZIP) ──────────────────────────────────────────┐
 * │  project.json          VFS metadata + full node tree (no content)│
 * │  domain.model          Semantic model (SemanticModel JSON)        │
 * │  diagrams/                                                        │
 * │    <fileId>.json  …    DiagramView content per diagram file       │
 * └───────────────────────────────────────────────────────────────────┘
 *
 * Splitting content into individual files mirrors the Eclipse / .docx
 * packaging convention: the archive is the container, each file inside
 * is independently readable and diff-able.
 *
 * ─── Import validation sequence ─────────────────────────────────────────────
 *
 * 1. File is a valid ZIP  (JSZip.loadAsync)
 * 2. project.json exists and parses
 * 3. domain.model exists and parses
 * 4. project.json contains valid projectName + domainModelId
 * 5. domain.model gate: nodes[domainModelId].type === FILE + .extension === '.model'
 * 6. Reconstruct full nodes dict by merging content from diagrams/
 * 7. Rehydrate: closeAllFiles → loadModel → loadProject
 *
 * ─── Hydration order (critical) ─────────────────────────────────────────────
 *
 * closeAllFiles()  — wipes stale tab IDs and legacy DiagramFile entries FIRST
 * loadModel()      — semantic data ready before canvas mounts
 * loadProject()    — fires last; React re-renders into already-clean state
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

/** Paths inside the ZIP archive. */
const ZIP_PROJECT_JSON = 'project.json';
const ZIP_DOMAIN_MODEL = 'domain.model';
const ZIP_DIAGRAMS_DIR = 'diagrams/';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Shape of project.json inside the archive.
 * Identical to LibreUMLProject except every VFSFile.content is null
 * (diagram content is stored separately in diagrams/).
 */
export interface LumlProjectManifest extends LibreUMLProject {
  _lumlVersion: string;
}

/** Thrown by importProject when validation fails.  Message is user-facing. */
export class ProjectImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectImportError';
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Builds a ZIP archive from the live VFSStore + ModelStore state and
 * triggers a browser download named `<project_slug>.luml`.
 */
export async function downloadProject(): Promise<void> {
  const project = useVFSStore.getState().project;
  const model   = useModelStore.getState().model;

  if (!project) {
    throw new Error('No active project to export. Please open or create a project first.');
  }

  const zip = new JSZip();

  // ── 1. project.json — manifest + VFS tree with content stripped ─────────
  //
  // Every VFSFile.content is set to null here.  The actual DiagramView for
  // each diagram file is written to diagrams/{fileId}.json below.
  const nodesStripped: Record<string, VFSFolder | VFSFile> = {};
  for (const [id, node] of Object.entries(project.nodes)) {
    nodesStripped[id] = node.type === 'FILE'
      ? { ...(node as VFSFile), content: null }
      : node;
  }

  const manifest: LumlProjectManifest = {
    ...project,
    _lumlVersion: LUML_FORMAT_VERSION,
    nodes: nodesStripped,
  };

  zip.file(ZIP_PROJECT_JSON, JSON.stringify(manifest, null, 2));

  // ── 2. domain.model — the semantic brain ──────────────────────────────────
  zip.file(ZIP_DOMAIN_MODEL, JSON.stringify(model ?? null, null, 2));

  // ── 3. diagrams/{fileId}.json — visual layout per diagram file ───────────
  //
  // Only FILE nodes with extension !== '.model' carry DiagramView content.
  // The .model sentinel has no visual content and is captured by domain.model.
  const diagramsFolder = zip.folder('diagrams')!;
  for (const node of Object.values(project.nodes)) {
    if (node.type === 'FILE' && (node as VFSFile).extension !== '.model') {
      const f = node as VFSFile;
      diagramsFolder.file(`${f.id}.json`, JSON.stringify(f.content ?? null, null, 2));
    }
  }

  // ── 4. Generate + download ─────────────────────────────────────────────────
  const slug = project.projectName
    .trim()
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
    || 'project';

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `${slug}.luml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Reads a .luml ZIP file, validates its structure, reconstructs all stores,
 * and returns the loaded LibreUMLProject.
 *
 * Accepts the raw File object so no FileReader plumbing is needed at the
 * call site — JSZip can open a Blob/File directly.
 *
 * Validation is strict and fail-fast: stores are never touched until all
 * checks pass, guaranteeing no partial/corrupted state injection.
 */
export async function importProject(file: File): Promise<LibreUMLProject> {
  // ── Step 1: Open ZIP ───────────────────────────────────────────────────────
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new ProjectImportError(
      'Invalid file: could not open as a ZIP archive. ' +
      'The file may be corrupted or was saved by an older version of LibreUML.'
    );
  }

  // ── Step 2: Validate required archive entries ─────────────────────────────
  const projectEntry = zip.file(ZIP_PROJECT_JSON);
  const modelEntry   = zip.file(ZIP_DOMAIN_MODEL);

  if (!projectEntry) {
    throw new ProjectImportError(
      `Invalid file: "${ZIP_PROJECT_JSON}" is missing from the archive. ` +
      'This does not appear to be a LibreUML project file.'
    );
  }

  if (!modelEntry) {
    throw new ProjectImportError(
      `Invalid file: "${ZIP_DOMAIN_MODEL}" is missing from the archive. ` +
      'The semantic model is absent — the project file is corrupt.'
    );
  }

  // ── Step 3: Parse project.json ────────────────────────────────────────────
  let manifest: LumlProjectManifest;
  try {
    manifest = JSON.parse(await projectEntry.async('string')) as LumlProjectManifest;
  } catch {
    throw new ProjectImportError(
      `"${ZIP_PROJECT_JSON}" contains invalid JSON. The project manifest is corrupted.`
    );
  }

  if (typeof manifest.projectName !== 'string' || !manifest.projectName.trim()) {
    throw new ProjectImportError(
      'Invalid project: projectName is missing or empty. The file may have been manually edited.'
    );
  }

  if (typeof manifest.domainModelId !== 'string' || !manifest.domainModelId) {
    throw new ProjectImportError(
      'Invalid project: domainModelId is missing or empty. The project manifest is corrupt.'
    );
  }

  if (typeof manifest.nodes !== 'object' || manifest.nodes === null) {
    throw new ProjectImportError(
      `Invalid project: nodes dictionary is missing from "${ZIP_PROJECT_JSON}".`
    );
  }

  // ── Step 4: domain.model gate (CRITICAL) ──────────────────────────────────
  //
  // Every valid LibreUML project contains a VFSFile named "domain.model" whose
  // id is stored in project.domainModelId.  This sentinel is the bridge between
  // the visual layer (VFSStore) and the semantic layer (ModelStore).  Without it,
  // all element name / relation lookups fail silently on the canvas.
  const domainModelNode = manifest.nodes[manifest.domainModelId];

  if (!domainModelNode) {
    throw new ProjectImportError(
      'Invalid project: the node referenced by domainModelId ' +
      `("${manifest.domainModelId}") is not present in the nodes dictionary. ` +
      'The project file is corrupted or was manually edited incorrectly.'
    );
  }

  if (domainModelNode.type !== 'FILE') {
    throw new ProjectImportError(
      'Invalid project: the domain model entry is not a FILE node. The project file is corrupt.'
    );
  }

  if ((domainModelNode as VFSFile).extension !== '.model') {
    throw new ProjectImportError(
      `Invalid project: the domain model entry has extension ` +
      `"${(domainModelNode as VFSFile).extension}" instead of ".model". ` +
      'The project file appears to be corrupted.'
    );
  }

  // ── Step 5: Parse domain.model ────────────────────────────────────────────
  let model: SemanticModel | null;
  try {
    const raw = JSON.parse(await modelEntry.async('string'));
    model = (typeof raw === 'object' && raw !== null) ? raw as SemanticModel : null;
  } catch {
    throw new ProjectImportError(
      `"${ZIP_DOMAIN_MODEL}" contains invalid JSON. The semantic model data is corrupted.`
    );
  }

  // ── Step 6: Reconstruct full nodes — merge diagram content from diagrams/ ─
  //
  // project.json stores all nodes with content: null.
  // diagrams/{fileId}.json holds the DiagramView for each diagram file.
  // We merge them here to produce the complete nodes dict.
  const nodes: Record<string, VFSFolder | VFSFile> = { ...manifest.nodes };

  const diagramEntries = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.startsWith(ZIP_DIAGRAMS_DIR)
  );

  await Promise.all(
    diagramEntries.map(async (entry) => {
      const fileId = entry.name
        .slice(ZIP_DIAGRAMS_DIR.length)   // strip "diagrams/"
        .replace(/\.json$/, '');          // strip ".json"

      if (!fileId || !nodes[fileId]) return;

      try {
        const content = JSON.parse(await entry.async('string')) as DiagramView | null;
        nodes[fileId] = { ...(nodes[fileId] as VFSFile), content };
      } catch {
        // Non-fatal: individual diagram corruption keeps the project loadable
        // but leaves that specific diagram blank.  Warn in the console.
        console.warn(
          `[LibreUML] Could not parse diagram "${fileId}" — content will be empty.`
        );
      }
    })
  );

  const project: LibreUMLProject = { ...manifest, nodes };

  // ── Step 7: Rehydrate stores (order is critical) ──────────────────────────
  //
  // 1. closeAllFiles() — wipes stale tab IDs and legacy DiagramFile entries
  //                      BEFORE any new project state triggers re-renders.
  // 2. loadModel()     — semantic data in place before canvas initialises.
  // 3. loadProject()   — fires last; React re-renders into already-clean state.
  useWorkspaceStore.getState().closeAllFiles();

  if (model !== null) {
    useModelStore.getState().loadModel(model);
  } else {
    useModelStore.getState().initModel(manifest.domainModelId);
  }

  useVFSStore.getState().loadProject(project);

  return project;
}
