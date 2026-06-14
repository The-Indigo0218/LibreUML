import { useWorkspaceStore } from "../../../store/workspace.store";
import { useVFSStore } from "../../../store/project-vfs.store";
import { useModelStore } from "../../../store/model.store";
import { useToastStore } from "../../../store/toast.store";
import { useUiStore } from "../../../store/uiStore";
import { standaloneModelOps, getLocalModel } from "../../../store/standaloneModelOps";
import { isDiagramView } from "../hooks/useVFSCanvasController";
import { defaultOperandCount } from "../../../core/domain/vfs/vfs.types";
import type { DiagramView, VFSFile, FragmentKind, SemanticModel } from "../../../core/domain/vfs/vfs.types";

interface ActiveSequence {
  tabId: string;
  isStandaloneFile: boolean;
  activeModel: SemanticModel;
  /** elementIds of every lifeline currently placed on the canvas. */
  lifelineIds: string[];
}

/**
 * Resolves the active tab to its sequence model and the lifelines on its canvas,
 * or null when the active tab isn't a sequence diagram. Shared by every
 * click-to-insert helper below so they reach the same store ops as the menus.
 */
function resolveActiveSequence(): ActiveSequence | null {
  const tabId = useWorkspaceStore.getState().activeTabId;
  if (!tabId) return null;

  const project = useVFSStore.getState().project;
  if (!project) return null;
  const fileNode = project.nodes[tabId];
  if (!fileNode || fileNode.type !== 'FILE') return null;
  const content = (fileNode as VFSFile).content;
  if (!isDiagramView(content)) return null;

  const isStandaloneFile = (fileNode as VFSFile).standalone === true;
  const activeModel = isStandaloneFile ? getLocalModel(tabId) : useModelStore.getState().model;
  if (!activeModel) return null;

  const lifelineIds = (content as DiagramView).nodes
    .map((vn) => vn.elementId)
    .filter((id): id is string => !!id && !!activeModel.lifelines?.[id]);

  return { tabId, isStandaloneFile, activeModel, lifelineIds };
}

/**
 * Inserts a combined fragment of the given kind into the active sequence diagram.
 * Covers every lifeline on the canvas (MVP policy) and seeds the operand count
 * the kind requires (alt/par/seq/strict → 2, the rest → 1).
 */
export function insertFragmentIntoActiveDiagram(fragmentKind: FragmentKind): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { tabId, isStandaloneFile, activeModel, lifelineIds } = ctx;

  if (lifelineIds.length === 0) {
    useToastStore.getState().show('⚠️ Crea al menos una lifeline antes de insertar un fragmento');
    return;
  }

  const operands = Array.from({ length: defaultOperandCount(fragmentKind) }, (_, i) => ({
    id: crypto.randomUUID(),
    guard: fragmentKind === 'ALT' && i === 1 ? 'else' : '',
    messageIds: [] as string[],
    fragmentIds: [] as string[],
  }));

  const name = `${fragmentKind.toLowerCase()}-${
    Object.keys(activeModel.interactionFragments ?? {}).length + 1
  }`;

  const payload = { name, fragmentKind, coveredLifelineIds: lifelineIds, operands };
  if (isStandaloneFile) standaloneModelOps(tabId).createFragment(payload);
  else useModelStore.getState().createFragment(payload);
}

/**
 * Inserts an InteractionUse (`ref`) covering every lifeline on the canvas, then
 * opens its properties so the user names the referenced interaction.
 */
export function insertInteractionUseIntoActiveDiagram(): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { tabId, isStandaloneFile, activeModel, lifelineIds } = ctx;

  if (lifelineIds.length === 0) {
    useToastStore.getState().show('⚠️ Crea al menos una lifeline antes de insertar un ref');
    return;
  }

  const payload = {
    name: '',
    coveredLifelineIds: lifelineIds,
    afterSequenceNumber: Object.keys(activeModel.messages ?? {}).length,
  };

  const newId = isStandaloneFile
    ? standaloneModelOps(tabId).createInteractionUse(payload)
    : useModelStore.getState().createInteractionUse(payload);

  useUiStore.getState().openInteractionUseProps(newId);
}

/**
 * Inserts a found (incoming from outside) or lost (outgoing to outside) message,
 * then opens its properties. `lifelineId` pins the real endpoint; when omitted
 * (palette insertion with no selection) it defaults to the first lifeline.
 */
export function insertEndpointMessageIntoActiveDiagram(
  variant: 'found' | 'lost',
  lifelineId?: string,
): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { tabId, isStandaloneFile, activeModel, lifelineIds } = ctx;

  const endpoint = lifelineId ?? lifelineIds[0];
  if (!endpoint || !activeModel.lifelines?.[endpoint]) {
    useToastStore.getState().show('⚠️ Crea al menos una lifeline antes de insertar un mensaje');
    return;
  }

  const sequenceNumber =
    Object.values(activeModel.messages ?? {}).reduce(
      (acc, m) => (m.sequenceNumber > acc ? m.sequenceNumber : acc),
      0,
    ) + 1;

  const payload = {
    name: '',
    messageKind: 'ASYNC' as const,
    sourceLifelineId: variant === 'lost' ? endpoint : '',
    targetLifelineId: variant === 'found' ? endpoint : '',
    sequenceNumber,
    ...(variant === 'found' ? { isFound: true } : { isLost: true }),
  };

  const newId = isStandaloneFile
    ? standaloneModelOps(tabId).createMessage(payload)
    : useModelStore.getState().createMessage(payload);

  useUiStore.getState().openMessageProps(newId);
}

/**
 * Inserts a general ordering (UML 2.5 §17.2) between the two earliest messages,
 * then opens its properties so the user can re-pick the endpoints. Requires at
 * least two messages — a temporal order needs two occurrences to relate.
 */
export function insertGeneralOrderingIntoActiveDiagram(): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { tabId, isStandaloneFile, activeModel } = ctx;

  const ordered = Object.values(activeModel.messages ?? {}).sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber,
  );
  if (ordered.length < 2) {
    useToastStore.getState().show('⚠️ Crea al menos dos mensajes antes de añadir un orden general');
    return;
  }

  const payload = {
    name: '',
    beforeMessageId: ordered[0].id,
    beforeEnd: 'RECEIVE' as const,
    afterMessageId: ordered[1].id,
    afterEnd: 'SEND' as const,
  };

  const newId = isStandaloneFile
    ? standaloneModelOps(tabId).createGeneralOrdering(payload)
    : useModelStore.getState().createGeneralOrdering(payload);

  useUiStore.getState().openGeneralOrderingProps(newId);
}

/**
 * Inserts a timing constraint (UML 2.5 §17.2) then opens its properties. DURATION
 * spans two occurrences (defaults to the first two messages); TIME anchors one
 * (defaults to the first message).
 */
export function insertTimeConstraintIntoActiveDiagram(variant: 'duration' | 'time'): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { tabId, isStandaloneFile, activeModel } = ctx;

  const ordered = Object.values(activeModel.messages ?? {}).sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber,
  );
  const need = variant === 'duration' ? 2 : 1;
  if (ordered.length < need) {
    useToastStore.getState().show(
      variant === 'duration'
        ? '⚠️ Crea al menos dos mensajes antes de añadir una duración'
        : '⚠️ Crea al menos un mensaje antes de añadir una marca de tiempo',
    );
    return;
  }

  const payload =
    variant === 'duration'
      ? {
          name: '',
          constraintKind: 'DURATION' as const,
          fromMessageId: ordered[0].id,
          fromEnd: 'RECEIVE' as const,
          toMessageId: ordered[1].id,
          toEnd: 'RECEIVE' as const,
          expression: '0..1s',
        }
      : {
          name: '',
          constraintKind: 'TIME' as const,
          fromMessageId: ordered[0].id,
          fromEnd: 'RECEIVE' as const,
          expression: 't=now',
        };

  const newId = isStandaloneFile
    ? standaloneModelOps(tabId).createTimeConstraint(payload)
    : useModelStore.getState().createTimeConstraint(payload);

  useUiStore.getState().openTimeConstraintProps(newId);
}

/**
 * Inserts a coregion (UML 2.5 §17.4) bracketing the first lifeline over the full
 * message span, then opens its properties. Requires at least one lifeline.
 */
export function insertCoregionIntoActiveDiagram(lifelineId?: string): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { tabId, isStandaloneFile, activeModel, lifelineIds } = ctx;

  const target = lifelineId ?? lifelineIds[0];
  if (!target || !activeModel.lifelines?.[target]) {
    useToastStore.getState().show('⚠️ Crea al menos una lifeline antes de insertar una coregión');
    return;
  }

  const messageCount = Object.keys(activeModel.messages ?? {}).length;
  const payload = {
    name: '',
    lifelineId: target,
    fromSequence: 0,
    toSequence: messageCount,
  };

  const newId = isStandaloneFile
    ? standaloneModelOps(tabId).createCoregion(payload)
    : useModelStore.getState().createCoregion(payload);

  useUiStore.getState().openCoregionProps(newId);
}

/**
 * Inserts a continuation (UML 2.5 §17.3) covering every lifeline on the canvas,
 * then opens its properties so the user names it. Requires at least one lifeline.
 */
export function insertContinuationIntoActiveDiagram(): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { tabId, isStandaloneFile, activeModel, lifelineIds } = ctx;

  if (lifelineIds.length === 0) {
    useToastStore.getState().show('⚠️ Crea al menos una lifeline antes de insertar una continuación');
    return;
  }

  const payload = {
    name: '',
    coveredLifelineIds: lifelineIds,
    afterSequenceNumber: Object.keys(activeModel.messages ?? {}).length,
  };

  const newId = isStandaloneFile
    ? standaloneModelOps(tabId).createContinuation(payload)
    : useModelStore.getState().createContinuation(payload);

  useUiStore.getState().openContinuationProps(newId);
}
