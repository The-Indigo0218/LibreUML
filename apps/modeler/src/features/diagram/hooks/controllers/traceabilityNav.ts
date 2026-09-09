/**
 * Cross-diagram navigation for the ADR-0010 traceability markers.
 *
 * A trace (`callsOperationId`, `realizesUseCaseId`, `representsId`) stores an
 * elementId, not a diagramId — the same element can appear on several
 * diagrams, or on none yet. Unlike `IRLifeline.decomposedAs` (which already
 * knows its target diagram), navigating a trace means searching the project
 * for a file that draws the element and jumping to the first one found. Best
 * effort: if nothing draws it yet, there is nowhere to jump.
 */
import { useVFSStore } from '../../../../store/project-vfs.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import type { VFSFile } from '../../../../core/domain/vfs/vfs.types';
import { isDiagramView } from '../useVFSCanvasController';

/** Opens (and focuses) the first project diagram that has a node for `elementId`. Silent no-op if none does. */
export function openDiagramContainingElement(elementId: string): void {
  const project = useVFSStore.getState().project;
  if (!project) return;

  const target = Object.values(project.nodes).find(
    (n): n is VFSFile =>
      n.type === 'FILE' &&
      isDiagramView((n as VFSFile).content) &&
      ((n as VFSFile).content as { nodes: { elementId?: string }[] }).nodes.some(
        (vn) => vn.elementId === elementId,
      ),
  );
  if (!target) return;

  useWorkspaceStore.getState().openTab(target.id);
  useWorkspaceStore.getState().setActiveTab(target.id);
}
