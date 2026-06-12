/**
 * Merge lifecycle action: returns a standalone .luml file back to the shared project.
 *
 * Folds the file's private localModel into the global SemanticModel via a generic
 * UUID remap (mergeStandaloneModel) — type-complete, so it works for class, use-case,
 * sequence, domain and any future diagram type, not just classes. Named classifiers
 * (class/interface/enum) get _1/_2 dedup against the global model; the DiagramView is
 * remapped; the file's localModel is cleared and the standalone flag flipped off.
 *
 * Extracted as a flat store-driven action (reads stores via getState) so it can be
 * reused from the project tree context menu, the Problems panel quick-fix and the
 * save-warning CTA without dragging React/contextMenu state along.
 */
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { useToastStore } from '../../../store/toast.store';
import { mergeStandaloneModel } from '../../../utils/mergeStandaloneModel';
import type { VFSFile, DiagramView } from '../../../core/domain/vfs/vfs.types';

export interface AddStandaloneResult {
  ok: boolean;
  /** Number of model elements merged into the global model (0 when flag-only). */
  mergedCount: number;
  /** Reason the action was a no-op, when ok === false. */
  reason?: 'no-project' | 'not-a-file';
}

/**
 * Add the standalone diagram file `fileId` back into the active project.
 * Shows a toast and returns a result describing what happened.
 */
export function addStandaloneToProject(fileId: string): AddStandaloneResult {
  const project = useVFSStore.getState().project;
  if (!project) return { ok: false, mergedCount: 0, reason: 'no-project' };

  const file = project.nodes[fileId] as VFSFile | undefined;
  if (!file || file.type !== 'FILE') return { ok: false, mergedCount: 0, reason: 'not-a-file' };

  const localModel = file.localModel;

  if (!localModel) {
    // No localModel — just flip the flag (backward-compat).
    useVFSStore.getState().updateNode(fileId, { standalone: false } as Partial<VFSFile>);
    useToastStore.getState().show(`"${file.name}" rejoined the project workspace`);
    return { ok: true, mergedCount: 0 };
  }

  const ms = useModelStore.getState();
  if (!ms.model) ms.initModel(project.domainModelId);
  const globalModel = useModelStore.getState().model!;

  const view = file.content && 'nodes' in (file.content as object)
    ? (file.content as DiagramView)
    : null;
  const { elements, packageNames, view: newView, mergedCount } = mergeStandaloneModel(localModel, view);

  // Name dedup for the classifier types validation cares about, in-place on the
  // freshly-remapped collections (the rest surface in the Problems panel if dup).
  const dedupe = (
    coll: Record<string, { name: string }> | undefined,
    existing: Set<string>,
  ) => {
    if (!coll) return;
    for (const el of Object.values(coll)) {
      let name = el.name;
      let i = 1;
      while (existing.has(name)) name = `${el.name}_${i++}`;
      existing.add(name);
      el.name = name;
    }
  };
  dedupe(elements.classes as Record<string, { name: string }>, new Set(Object.values(globalModel.classes).map((c) => c.name)));
  dedupe(elements.interfaces as Record<string, { name: string }>, new Set(Object.values(globalModel.interfaces).map((i) => i.name)));
  dedupe(elements.enums as Record<string, { name: string }>, new Set(Object.values(globalModel.enums).map((e) => e.name)));

  useModelStore.getState().mergeModelElements(elements, packageNames);
  useVFSStore.getState().updateNode(fileId, {
    standalone: false,
    localModel: null,
    content: newView ?? file.content,
  } as Partial<VFSFile>);

  useToastStore.getState().show(`"${file.name}" merged — ${mergedCount} element${mergedCount !== 1 ? 's' : ''} added to project`);
  return { ok: true, mergedCount };
}
