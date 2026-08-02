import { useWorkspaceStore } from "../../../store/workspace.store";
import { useVFSStore } from "../../../store/project-vfs.store";
import { useModelStore } from "../../../store/model.store";
import { useToastStore } from "../../../store/toast.store";
import { useUiStore } from "../../../store/uiStore";
import { standaloneModelOps, getLocalModel } from "../../../store/standaloneModelOps";
import { isDiagramView } from "../hooks/useVFSCanvasController";
import { defaultMessageName, nextMessageSequenceNumber } from "../../../hooks/canvas/sequenceMessageHelpers";
import { yToMessageSlot, computeSlotLayout } from "../hooks/controllers/sequenceDiagramNodes";
import { defaultOperandCount } from "../../../core/domain/vfs/vfs.types";
import type { DiagramView, VFSFile, FragmentKind, SemanticModel } from "../../../core/domain/vfs/vfs.types";
import i18n from "../../../i18n/config";

/**
 * Warn the user that a precondition is missing. This module is a plain service,
 * not a component, so it reads the i18n instance directly instead of `useTranslation`.
 * The ⚠️ lives here rather than in the locale files — it is presentation, not language.
 */
function warn(key: string): void {
  useToastStore.getState().show(`⚠️ ${i18n.t(`sequenceInserts.${key}`)}`);
}

interface ActiveSequence {
  activeModel: SemanticModel;
  /**
   * Model mutators for this tab, already resolved to the standalone-file ops or
   * the global model store. Every helper below writes through this, so none of
   * them has to repeat the standalone branch.
   */
  ops: ReturnType<typeof standaloneModelOps> | ReturnType<typeof useModelStore.getState>;
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

  const ops = isStandaloneFile ? standaloneModelOps(tabId) : useModelStore.getState();

  return { activeModel, ops, lifelineIds };
}

/** A world-space rectangle (drawn fragment box), in canvas coordinates. */
export interface CoverageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Pure geometry resolver for the "draw a fragment" gesture (G-a): given the drawn
 * rectangle, the lifeline center-Xs and the on-canvas message Ys, returns which
 * lifelines the box spans (X) and which messages fall inside it (Y). Tolerant by
 * design — a lifeline counts when its centerline is within the box and a message
 * when its glyph Y is within it, so the user never needs pixel-perfect framing.
 */
export function resolveFragmentCoverage(
  rect: CoverageRect,
  lifelines: { id: string; centerX: number }[],
  messages: { id: string; y: number }[],
): { coveredLifelineIds: string[]; messageIds: string[] } {
  const x2 = rect.x + rect.width;
  const y2 = rect.y + rect.height;
  const coveredLifelineIds = lifelines
    .filter((l) => l.centerX >= rect.x && l.centerX <= x2)
    .map((l) => l.id);
  const messageIds = messages
    .filter((m) => m.y >= rect.y && m.y <= y2)
    .map((m) => m.id);
  return { coveredLifelineIds, messageIds };
}

/**
 * Creates a combined fragment of the given kind, covering the passed lifelines and
 * seeding operand 0 with the passed messages. When `coveredLifelineIds` is empty
 * it falls back to covering every lifeline on the canvas (the legacy click-insert
 * policy). The box itself stays derived — it auto-fits the captured messages — and
 * the user can move/resize it afterwards (hybrid layout overrides).
 */
export function insertFragmentWithCoverage(
  fragmentKind: FragmentKind,
  coveredLifelineIds: string[] = [],
  messageIds: string[] = [],
): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { activeModel, ops, lifelineIds } = ctx;

  const covered = coveredLifelineIds.length > 0 ? coveredLifelineIds : lifelineIds;
  if (covered.length === 0) {
    warn('needLifelineForFragment');
    return;
  }

  const operands = Array.from({ length: defaultOperandCount(fragmentKind) }, (_, i) => ({
    id: crypto.randomUUID(),
    guard: fragmentKind === 'ALT' && i === 1 ? 'else' : '',
    messageIds: i === 0 ? [...messageIds] : ([] as string[]),
    fragmentIds: [] as string[],
  }));

  const name = `${fragmentKind.toLowerCase()}-${
    Object.keys(activeModel.interactionFragments ?? {}).length + 1
  }`;

  const payload = { name, fragmentKind, coveredLifelineIds: covered, operands };
  ops.createFragment(payload);
}

/**
 * Inserts a combined fragment covering every lifeline on the canvas (the legacy
 * click-to-insert / context-menu policy). Thin wrapper over
 * {@link insertFragmentWithCoverage}.
 */
export function insertFragmentIntoActiveDiagram(fragmentKind: FragmentKind): void {
  insertFragmentWithCoverage(fragmentKind);
}

/**
 * Inserts an InteractionUse (`ref`) covering every lifeline on the canvas, then
 * opens its properties so the user names the referenced interaction.
 */
export function insertInteractionUseIntoActiveDiagram(): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { activeModel, ops, lifelineIds } = ctx;

  if (lifelineIds.length === 0) {
    warn('needLifelineForRef');
    return;
  }

  const payload = {
    name: '',
    coveredLifelineIds: lifelineIds,
    afterSequenceNumber: Object.keys(activeModel.messages ?? {}).length,
  };

  const newId = ops.createInteractionUse(payload);

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
  const { activeModel, ops, lifelineIds } = ctx;

  const endpoint = lifelineId ?? lifelineIds[0];
  if (!endpoint || !activeModel.lifelines?.[endpoint]) {
    warn('needLifelineForMessage');
    return;
  }

  const sequenceNumber = nextMessageSequenceNumber(activeModel.messages ?? {});

  const payload = {
    name: '',
    messageKind: 'ASYNC' as const,
    sourceLifelineId: variant === 'lost' ? endpoint : '',
    targetLifelineId: variant === 'found' ? endpoint : '',
    sequenceNumber,
    ...(variant === 'found' ? { isFound: true } : { isLost: true }),
  };

  const newId = ops.createMessage(payload);

  useUiStore.getState().openMessageProps(newId);
}

/**
 * Is there an execution on `lifelineId` that is still active across `slot`? An
 * execution counts when it starts before the slot and has not returned before it
 * (no reply yet, or its reply lands at/after the slot). Open self-calls count too
 * — a self-message nested on one is a valid deeper call-stack frame.
 */
function hasActiveExecutionAt(model: SemanticModel, lifelineId: string, slot: number): boolean {
  const acts = model.activations ?? {};
  const msgs = model.messages ?? {};
  for (const a of Object.values(acts)) {
    if (a.lifelineId !== lifelineId) continue;
    const startMsg = msgs[a.startMessageId];
    if (!startMsg) continue;
    if (startMsg.sequenceNumber >= slot) continue;
    const endSeq = a.endMessageId ? (msgs[a.endMessageId]?.sequenceNumber ?? Infinity) : Infinity;
    if (endSeq >= slot) return true;
  }
  return false;
}

/**
 * Creates a self-message on a single lifeline (source === target). It is a SYNC
 * message, so the store auto-creates the paired nested Activation on that same
 * lifeline (re-entrant execution). This is the only sanctioned way to make a
 * self-message — drawing a manual connection back onto a lifeline is blocked.
 *
 * `dropY` (world Y of a right-click on the lifeline body) drops the message at the
 * slot under the cursor instead of appending at the end: insertMessageAt shifts
 * later messages down and the store auto-nests the new frame into whatever
 * execution is open at that slot (it *respects the existing activation*). Omitting
 * `dropY` appends at the end as before. Opens the props modal so the user can name
 * it / adjust it right away.
 */
export function insertSelfMessageIntoActiveDiagram(lifelineId?: string, dropY?: number, force = false): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { activeModel, ops, lifelineIds } = ctx;

  const target = lifelineId ?? lifelineIds[0];
  if (!target || !activeModel.lifelines?.[target]) {
    warn('needLifelineForMessage');
    return;
  }

  const messageCount = Object.keys(activeModel.messages ?? {}).length;
  // P1 — drop at the slot under the cursor (clamped to [1, count+1]); the +1 lets a
  // drop below the last message append. No drop point → append at the end.
  const sequenceNumber =
    dropY != null
      ? yToMessageSlot(dropY, messageCount + 1, computeSlotLayout(activeModel))
      : messageCount + 1;

  // Validation: a self-message is a call made *during* an execution. If the drop
  // point isn't inside any active execution on this lifeline, confirm via a modal
  // before creating a stray top-level frame (the user can still create it).
  if (!force && !hasActiveExecutionAt(activeModel, target, sequenceNumber)) {
    useUiStore.getState().openSelfMessageWarning({ lifelineId: target, dropY });
    return;
  }

  const payload = {
    name: defaultMessageName('SYNC'),
    messageKind: 'SYNC' as const,
    sourceLifelineId: target,
    targetLifelineId: target,
    sequenceNumber,
  };

  // insertMessageAt shifts existing messages at/after the slot down and auto-nests
  // into the innermost open execution at that point (degenerates to append when the
  // slot is count+1).
  const newId = ops.insertMessageAt(payload);

  useUiStore.getState().openMessageProps(newId);
}

/**
 * Inserts a self-message nested inside a specific execution (activation bar).
 * Unlike the lifeline action — which infers the parent from the drop point — this
 * anchors the new call right after the activation's own start, so it always lands
 * as a deeper frame INSIDE that execution. Opens the message properties modal so
 * the user fills in the call name (and any other values) right away.
 */
export function insertSelfMessageInActivation(activationId: string): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { activeModel, ops } = ctx;

  const act = activeModel.activations?.[activationId];
  if (!act) return;
  const lifelineId = act.lifelineId;
  if (!activeModel.lifelines?.[lifelineId]) return;

  const startMsg = activeModel.messages?.[act.startMessageId];
  if (!startMsg) return;

  // Drop the call one slot after this execution's start. insertMessageAt shifts
  // later messages down and auto-nests via parentActivationId, so the new bar
  // becomes a child frame of THIS activation.
  const sequenceNumber = startMsg.sequenceNumber + 1;

  const payload = {
    name: defaultMessageName('SYNC'),
    messageKind: 'SYNC' as const,
    sourceLifelineId: lifelineId,
    targetLifelineId: lifelineId,
    sequenceNumber,
  };

  const newId = ops.insertMessageAt(payload);

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
  const { activeModel, ops } = ctx;

  const ordered = Object.values(activeModel.messages ?? {}).sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber,
  );
  if (ordered.length < 2) {
    warn('needTwoMessagesForOrdering');
    return;
  }

  const payload = {
    name: '',
    beforeMessageId: ordered[0].id,
    beforeEnd: 'RECEIVE' as const,
    afterMessageId: ordered[1].id,
    afterEnd: 'SEND' as const,
  };

  const newId = ops.createGeneralOrdering(payload);

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
  const { activeModel, ops } = ctx;

  const ordered = Object.values(activeModel.messages ?? {}).sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber,
  );
  const need = variant === 'duration' ? 2 : 1;
  if (ordered.length < need) {
    warn(variant === 'duration' ? 'needTwoMessagesForDuration' : 'needMessageForTimeMark');
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

  const newId = ops.createTimeConstraint(payload);

  useUiStore.getState().openTimeConstraintProps(newId);
}

/**
 * Inserts a coregion (UML 2.5 §17.4) bracketing the first lifeline over the full
 * message span, then opens its properties. Requires at least one lifeline.
 */
export function insertCoregionIntoActiveDiagram(lifelineId?: string): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { activeModel, ops, lifelineIds } = ctx;

  const target = lifelineId ?? lifelineIds[0];
  if (!target || !activeModel.lifelines?.[target]) {
    warn('needLifelineForCoregion');
    return;
  }

  const messageCount = Object.keys(activeModel.messages ?? {}).length;
  const payload = {
    name: '',
    lifelineId: target,
    fromSequence: 0,
    toSequence: messageCount,
  };

  const newId = ops.createCoregion(payload);

  useUiStore.getState().openCoregionProps(newId);
}

/**
 * Inserts a continuation (UML 2.5 §17.3) covering every lifeline on the canvas,
 * then opens its properties so the user names it. Requires at least one lifeline.
 */
export function insertContinuationIntoActiveDiagram(): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { activeModel, ops, lifelineIds } = ctx;

  if (lifelineIds.length === 0) {
    warn('needLifelineForContinuation');
    return;
  }

  const payload = {
    name: '',
    coveredLifelineIds: lifelineIds,
    afterSequenceNumber: Object.keys(activeModel.messages ?? {}).length,
  };

  const newId = ops.createContinuation(payload);

  useUiStore.getState().openContinuationProps(newId);
}

/**
 * Reverses a message's direction (swaps source/target lifelines), mirroring the
 * "Reverse Direction" action available on class-diagram relations. Self-messages
 * are a no-op (source === target).
 */
export function reverseMessageInActiveDiagram(messageId: string): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { activeModel, ops } = ctx;
  const msg = activeModel.messages?.[messageId];
  if (!msg) return;
  const patch = {
    sourceLifelineId: msg.targetLifelineId,
    targetLifelineId: msg.sourceLifelineId,
  };
  ops.updateMessage(messageId, patch);
}

/** Deletes a message (and cascades its paired activation) from the active diagram. */
export function deleteMessageInActiveDiagram(messageId: string): void {
  const ctx = resolveActiveSequence();
  if (!ctx) return;
  const { activeModel, ops } = ctx;
  if (!activeModel.messages?.[messageId]) return;
  ops.deleteMessage(messageId);
}
