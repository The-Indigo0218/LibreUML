import { useWorkspaceStore } from "../../../store/workspace.store";
import { useVFSStore } from "../../../store/project-vfs.store";
import { useModelStore } from "../../../store/model.store";
import { useToastStore } from "../../../store/toast.store";
import { standaloneModelOps, getLocalModel } from "../../../store/standaloneModelOps";
import { isDiagramView } from "../hooks/useVFSCanvasController";
import { defaultOperandCount } from "../../../core/domain/vfs/vfs.types";
import type { DiagramView, VFSFile, FragmentKind } from "../../../core/domain/vfs/vfs.types";

/**
 * Inserts a combined fragment of the given kind into the active sequence diagram.
 * Shared by the pane context menu and the tool palette so both reach the same
 * store ops. Covers every lifeline currently on the canvas (MVP policy) and seeds
 * the operand count the kind requires (alt/par/seq/strict → 2, the rest → 1).
 */
export function insertFragmentIntoActiveDiagram(fragmentKind: FragmentKind): void {
  const tabId = useWorkspaceStore.getState().activeTabId;
  if (!tabId) return;

  const project = useVFSStore.getState().project;
  if (!project) return;
  const fileNode = project.nodes[tabId];
  if (!fileNode || fileNode.type !== 'FILE') return;
  const content = (fileNode as VFSFile).content;
  if (!isDiagramView(content)) return;

  const isStandaloneFile = (fileNode as VFSFile).standalone === true;
  const activeModel = isStandaloneFile
    ? getLocalModel(tabId)
    : useModelStore.getState().model;
  if (!activeModel) return;

  const lifelineIds = (content as DiagramView).nodes
    .map((vn) => vn.elementId)
    .filter((id): id is string => !!id && !!activeModel.lifelines?.[id]);

  if (lifelineIds.length === 0) {
    useToastStore.getState().show('⚠️ Crea al menos una lifeline antes de insertar un fragmento');
    return;
  }

  const operandCount = defaultOperandCount(fragmentKind);
  const operands = Array.from({ length: operandCount }, (_, i) => ({
    id: crypto.randomUUID(),
    guard: fragmentKind === 'ALT' && i === 1 ? 'else' : '',
    messageIds: [] as string[],
    fragmentIds: [] as string[],
  }));

  const name = `${fragmentKind.toLowerCase()}-${
    Object.keys(activeModel.interactionFragments ?? {}).length + 1
  }`;

  if (isStandaloneFile) {
    standaloneModelOps(tabId).createFragment({ name, fragmentKind, coveredLifelineIds: lifelineIds, operands });
  } else {
    useModelStore.getState().createFragment({ name, fragmentKind, coveredLifelineIds: lifelineIds, operands });
  }
}
