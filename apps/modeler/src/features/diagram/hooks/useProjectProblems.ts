import { useMemo } from 'react';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { validateModel } from '../utils/validateModel';
import { resolveSemanticElement } from './controllers/sharedNodeBuilders';
import { isDiagramView } from './useVFSCanvasController';
import { addStandaloneToProject } from '../actions/addStandaloneToProject';
import { getDiagramRegistry, isDiagramTypeRegistered } from '../../../core/registry/diagram-registry';
import { activityDiagramValidator } from '../../../core/validation/activity-diagram.validator';
import { resolvedElementToDomainNode, relationToDomainEdge } from './domainNodeAdapter';
import type { DomainNode } from '../../../core/domain/models/nodes';
import type { VFSFile, SemanticModel } from '../../../core/domain/vfs/vfs.types';

export type ProblemSeverity = 'error' | 'warning' | 'info';
export type ProblemCategory = 'model' | 'structure' | 'save' | 'validation';

export interface ProblemFix {
  label: string;
  run: () => void;
}

export interface Problem {
  id: string;
  severity: ProblemSeverity;
  category: ProblemCategory;
  message: string;
  /** File id of the diagram this problem belongs to (absent = project-wide). */
  diagramId?: string;
  diagramName?: string;
  fix?: ProblemFix;
}

export interface ProjectProblems {
  problems: Problem[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

const EMPTY: ProjectProblems = { problems: [], errorCount: 0, warningCount: 0, infoCount: 0 };

/**
 * Runs `getDiagramRegistry(file.diagramType).validator` (§16) over every node
 * and edge of one diagram, via `domainNodeAdapter`. This is what makes each
 * diagram type's `validateNode`/`validateEdge` reach a surface the user
 * actually looks at — until A5 they were "inversión hecha y desconectada"
 * (§16.1): the rules existed, nobody saw them.
 *
 * Activity Diagram additionally runs `validateActivityStructure` (fan-in/
 * fan-out on decision/merge/fork/join), a special entry point BaseValidator
 * has no room for — same reasoning as `SequenceDiagramValidator.validateMessage`
 * needing the full model, not just two endpoints.
 */
function pushRegistryValidation(
  problems: Problem[],
  file: VFSFile,
  model: SemanticModel,
): void {
  if (!isDiagramView(file.content) || !isDiagramTypeRegistered(file.diagramType)) return;
  const validator = getDiagramRegistry(file.diagramType).validator;

  const nodesById = new Map<string, DomainNode>();
  let i = 0;

  for (const vn of file.content.nodes) {
    if (!vn.elementId) continue;
    const resolved = resolveSemanticElement(model, vn.elementId);
    const domainNode = resolvedElementToDomainNode(resolved, model);
    if (!domainNode) continue;
    nodesById.set(vn.elementId, domainNode);

    const result = validator.validateNode(domainNode);
    for (const msg of result.errors ?? []) {
      problems.push({ id: `validation:${file.id}:${i++}`, severity: 'error', category: 'validation', message: msg, diagramId: file.id, diagramName: file.name });
    }
    for (const msg of result.warnings ?? []) {
      problems.push({ id: `validation:${file.id}:${i++}`, severity: 'warning', category: 'validation', message: msg, diagramId: file.id, diagramName: file.name });
    }
  }

  for (const ve of file.content.edges) {
    const rel = model.relations?.[ve.relationId];
    if (!rel) continue;
    const domainEdge = relationToDomainEdge(rel, file.diagramType);
    if (!domainEdge) continue;
    const src = nodesById.get(rel.sourceId);
    const tgt = nodesById.get(rel.targetId);
    if (!src || !tgt) continue; // dangling endpoint — already surfaced by the 'structure' check

    const result = validator.validateEdge(domainEdge, src, tgt);
    for (const msg of result.errors ?? []) {
      problems.push({ id: `validation:${file.id}:${i++}`, severity: 'error', category: 'validation', message: msg, diagramId: file.id, diagramName: file.name });
    }
    for (const msg of result.warnings ?? []) {
      problems.push({ id: `validation:${file.id}:${i++}`, severity: 'warning', category: 'validation', message: msg, diagramId: file.id, diagramName: file.name });
    }
  }

  if (file.diagramType === 'ACTIVITY_DIAGRAM') {
    const activityIds = new Set(
      Object.values(model.activityNodes ?? {})
        .filter((n) => nodesById.has(n.id))
        .map((n) => n.activityId),
    );
    for (const activityId of activityIds) {
      const result = activityDiagramValidator.validateActivityStructure(activityId, model);
      for (const msg of result.warnings ?? []) {
        problems.push({ id: `validation:${file.id}:activity:${activityId}:${i++}`, severity: 'warning', category: 'validation', message: msg, diagramId: file.id, diagramName: file.name });
      }
    }
  }
}

/**
 * Project-wide problem aggregation for ALL diagram types.
 *
 * Walks every diagram FILE in the active project and folds three sources into a
 * single, navigable list with optional quick-fixes:
 *   - **model**: structural validation (validateModel, B2) of the global model
 *     AND each standalone's private localModel — duplicate classifiers/members.
 *   - **save**: standalone files sit outside the project, so they're silently
 *     excluded from the `.luml.zip` export (gap F1) → warning + "Add to Project".
 *   - **structure**: view nodes whose elementId resolves to UNKNOWN (orphan
 *     reference to a missing IR element) → they render as Notes.
 *
 * Pure read over the stores; safe to call from the StatusBar badge + ProblemsPanel.
 */
export function useProjectProblems(): ProjectProblems {
  const project = useVFSStore((s) => s.project);
  const globalModel = useModelStore((s) => s.model);

  return useMemo(() => {
    if (!project?.nodes) return EMPTY;

    const problems: Problem[] = [];

    const diagramFiles = Object.values(project.nodes).filter(
      (n): n is VFSFile => n.type === 'FILE' && (n as VFSFile).extension === '.luml',
    );

    // ── model: global model validation (project-wide, no single diagram) ──────
    for (const [i, msg] of validateModel(globalModel).errors.entries()) {
      problems.push({ id: `model:global:${i}`, severity: 'error', category: 'model', message: msg });
    }

    for (const file of diagramFiles) {
      const isStandalone = file.standalone === true;

      // ── model: each standalone validates its own private localModel ─────────
      if (isStandalone && file.localModel) {
        for (const [i, msg] of validateModel(file.localModel).errors.entries()) {
          problems.push({
            id: `model:${file.id}:${i}`,
            severity: 'error',
            category: 'model',
            message: msg,
            diagramId: file.id,
            diagramName: file.name,
          });
        }
      }

      // ── save: standalone is excluded from project export (gap F1) ───────────
      if (isStandalone) {
        problems.push({
          id: `save:${file.id}`,
          severity: 'warning',
          category: 'save',
          message: `"${file.name}" is standalone — it will be excluded when you export the project.`,
          diagramId: file.id,
          diagramName: file.name,
          fix: { label: 'Add to Project', run: () => addStandaloneToProject(file.id) },
        });
      }

      // ── structure: orphan view nodes (elementId → missing IR element) ───────
      const model: SemanticModel | null = isStandalone ? file.localModel ?? null : globalModel;
      if (model && isDiagramView(file.content)) {
        let orphanCount = 0;
        for (const vn of file.content.nodes) {
          if (!vn.elementId) continue;
          if (resolveSemanticElement(model, vn.elementId).kind === 'UNKNOWN') orphanCount++;
        }
        if (orphanCount > 0) {
          problems.push({
            id: `structure:${file.id}`,
            severity: 'warning',
            category: 'structure',
            message: `"${file.name}" has ${orphanCount} element${orphanCount !== 1 ? 's' : ''} not in the model — ${orphanCount !== 1 ? 'they render' : 'it renders'} as a Note.`,
            diagramId: file.id,
            diagramName: file.name,
          });
        }

        // ── validation: per-diagram-type registry validator (§16) ──────────────
        pushRegistryValidation(problems, file, model);
      }
    }

    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    for (const p of problems) {
      if (p.severity === 'error') errorCount++;
      else if (p.severity === 'warning') warningCount++;
      else infoCount++;
    }

    return { problems, errorCount, warningCount, infoCount };
  }, [project, globalModel]);
}
