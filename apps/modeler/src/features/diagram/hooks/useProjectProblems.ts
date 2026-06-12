import { useMemo } from 'react';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { validateModel } from '../utils/validateModel';
import { resolveSemanticElement } from './controllers/sharedNodeBuilders';
import { isDiagramView } from './useVFSCanvasController';
import { addStandaloneToProject } from '../actions/addStandaloneToProject';
import type { VFSFile, SemanticModel } from '../../../core/domain/vfs/vfs.types';

export type ProblemSeverity = 'error' | 'warning' | 'info';
export type ProblemCategory = 'model' | 'structure' | 'save';

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
