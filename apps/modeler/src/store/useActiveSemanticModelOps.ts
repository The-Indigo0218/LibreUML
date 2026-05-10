import { useWorkspaceStore } from './workspace.store';
import { useVFSStore } from './project-vfs.store';
import { useModelStore } from './model.store';
import { standaloneModelOps, getLocalModel } from './standaloneModelOps';

export function useActiveSemanticModelOps() {
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const isStandalone = !!(
    activeTabId &&
    project?.nodes[activeTabId] &&
    (project.nodes[activeTabId] as any).standalone === true
  );

  function getModel() {
    return isStandalone && activeTabId
      ? getLocalModel(activeTabId)
      : useModelStore.getState().model;
  }

  function getOps() {
    if (isStandalone && activeTabId) return standaloneModelOps(activeTabId);
    return useModelStore.getState() as unknown as ReturnType<typeof standaloneModelOps>;
  }

  return { isStandalone, activeTabId, getModel, getOps };
}
