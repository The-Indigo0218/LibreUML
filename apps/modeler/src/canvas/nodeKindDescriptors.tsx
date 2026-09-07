import type React from 'react';
import type { AnyNodeViewModel, NodeViewModel } from '../adapters/view-models/node.view-model';
import type { NodeKind } from '../adapters/view-models/node-kind';
import type { NodeShapeRenderProps } from './ShapeRouter';
import ClassShape, { getClassShapeSize } from './shapes/ClassShape';
import NoteShape, { getNoteShapeSize } from './shapes/NoteShape';
import ActorShape, { getActorShapeSize } from './shapes/ActorShape';
import UseCaseShape, { getUseCaseShapeSize } from './shapes/UseCaseShape';
import SystemBoundaryShape, { getSystemBoundaryShapeSize } from './shapes/SystemBoundaryShape';
import UCModuleShape, { getUCModuleShapeSize } from './shapes/UCModuleShape';
import DomainEntityShape, { getDomainEntityShapeSize } from './shapes/DomainEntityShape';
import LifelineShape, { getLifelineShapeSize } from './shapes/LifelineShape';
import MessageShape, { getMessageShapeSize } from './shapes/MessageShape';
import ActivationShape, { getActivationShapeSize } from './shapes/ActivationShape';
import FragmentShape, { getFragmentShapeSize } from './shapes/FragmentShape';
import StateInvariantShape, { getStateInvariantShapeSize } from './shapes/StateInvariantShape';
import InteractionUseShape, { getInteractionUseShapeSize } from './shapes/InteractionUseShape';
import GateShape, { getGateShapeSize } from './shapes/GateShape';
import GeneralOrderingShape, { getGeneralOrderingShapeSize } from './shapes/GeneralOrderingShape';
import TimeConstraintShape, { getTimeConstraintShapeSize } from './shapes/TimeConstraintShape';
import CoregionShape, { getCoregionShapeSize } from './shapes/CoregionShape';
import ContinuationShape, { getContinuationShapeSize } from './shapes/ContinuationShape';
import ActionShape, { getActionShapeSize } from './shapes/ActionShape';
import ControlNodeShape, { getControlNodeShapeSize } from './shapes/ControlNodeShape';
import DecisionShape, { getDecisionShapeSize } from './shapes/DecisionShape';
import ForkJoinShape, { getForkJoinShapeSize } from './shapes/ForkJoinShape';
import ObjectNodeShape, { getObjectNodeShapeSize } from './shapes/ObjectNodeShape';
import PinShape, { getPinShapeSize } from './shapes/PinShape';
import StructuredNodeShape, { getStructuredNodeShapeSize } from './shapes/StructuredNodeShape';

export interface NodeSize {
  width: number;
  height: number;
}

/** Props every shape accepts, once the optional ones have been peeled off. */
export type CommonShapeProps = Omit<
  NodeShapeRenderProps,
  'key' | 'onMouseEnter' | 'onMouseLeave' | 'onResizeEnd' | 'onResetTimeline' | 'isDropTarget'
>;

/**
 * `renderShape` peels the optional props off once and hands the rest through as
 * `common`, exactly as the old if-chain did. Each entry opts back into the ones
 * its shape actually declares.
 */
export interface NodeRenderArgs {
  key: string;
  common: CommonShapeProps;
  onMouseEnter: NodeShapeRenderProps['onMouseEnter'];
  onMouseLeave: NodeShapeRenderProps['onMouseLeave'];
  onResizeEnd: NodeShapeRenderProps['onResizeEnd'];
  onResetTimeline: NodeShapeRenderProps['onResetTimeline'];
  isDropTarget: NodeShapeRenderProps['isDropTarget'];
}

/**
 * What double-clicking a node opens. Named rather than bound: the handlers live
 * in `KonvaCanvas`' component scope, so the table stays declarative data and
 * the canvas maps each name to its own closure.
 */
export type NodeEditor =
  | 'noteInline'
  | 'useCaseModal'
  | 'lifelineOpenOrRename'
  | 'fragmentPanel'
  | 'inlineRename'
  | 'stateInvariantPanel'
  | 'interactionUsePanel'
  | 'gatePanel'
  | 'generalOrderingProps'
  | 'timeConstraintProps'
  | 'coregionProps'
  | 'continuationProps'
  | 'classEditor'
  /** Falls through to the view model's own `onOpenProps`, if it has one. */
  | 'openProps'
  /**
   * No double-click behaviour at all: the package toggles collapse from its own
   * layer, and a control node is a filled circle with nothing to edit.
   */
  | 'none';

/** Which resize handler commits the new size. */
export type NodeResize =
  | 'fragment'
  | 'lifelineTimeline'
  | 'interactionUse'
  | 'stateInvariant'
  | 'note'
  | 'ucModule'
  /** Applied by the package layer, which resizes outside the main render loop. */
  | 'package'
  /** Applied by the partition layer — same reasoning as `'package'`. */
  | 'activityPartition'
  /** A structured node's own min size (v1.1) — smaller than a system boundary's. */
  | 'activityStructured'
  /** The historical default for every kind without one of its own. */
  | 'systemBoundary';

/**
 * `vertical` locks X and persists Y through a store-backed drag; `horizontal`
 * is the lifeline, which slides along the header row with its Y pinned.
 */
export type NodeDragAxis = 'free' | 'vertical' | 'horizontal';

/** Which drag-end handler persists the move. */
export type NodeDragEnd = 'message' | 'derived' | 'fragment' | 'node';

/**
 * What the canvas needs to know about a node kind, as data (ADR-0009).
 *
 * `size` and `render` describe the **ShapeRouter path**. A kind may opt out of
 * it with `null` when it owns a dedicated path in `KonvaCanvas` — today only
 * the package does, because its size depends on its children and its shape is
 * drawn in its own background layer.
 *
 * The remaining fields replace the ternary chains in the canvas' render loop.
 * They are deliberately spelled out on every kind rather than defaulted: a new
 * kind should have to state what it does, not inherit it by omission.
 */
export interface NodeKindDescriptor {
  size: ((vm: never) => NodeSize) | null;
  render: ((vm: never, args: NodeRenderArgs) => React.ReactNode) | null;
  editor: NodeEditor;
  resize: NodeResize;
  draggable: boolean;
  dragAxis: NodeDragAxis;
  dragEnd: NodeDragEnd;
  /** Only the lifeline offers the foot-handle reset (G-c). */
  resetTimeline: boolean;
}

/**
 * Binds an entry to the concrete view model of its kind, so each stays
 * type-checked against its own shape component instead of being cast at the
 * call site.
 */
function describe<VM extends AnyNodeViewModel>(
  entry: Omit<NodeKindDescriptor, 'size' | 'render'> & {
    size: ((vm: VM) => NodeSize) | null;
    render: ((vm: VM, args: NodeRenderArgs) => React.ReactNode) | null;
  },
): NodeKindDescriptor {
  return entry as NodeKindDescriptor;
}

export const NODE_KIND_DESCRIPTORS: Record<NodeKind, NodeKindDescriptor> = {
  class: describe<NodeViewModel>({
    size: getClassShapeSize,
    render: (vm, { key, common }) => <ClassShape key={key} viewModel={vm} {...common} />,
    editor: 'classEditor',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  note: describe({
    size: getNoteShapeSize,
    render: (vm, { key, common, onResizeEnd }) => (
      <NoteShape key={key} viewModel={vm} {...common} onResizeEnd={onResizeEnd} />
    ),
    editor: 'noteInline',
    resize: 'note',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  // The package sizes itself from its children and draws in the background
  // layer, so it never travels the ShapeRouter path nor the main render loop:
  // its own block in KonvaCanvas supplies the handlers. The behaviour recorded
  // here describes that block, so the table stays a true picture of the canvas.
  package: describe({
    size: null,
    render: null,
    editor: 'none',
    resize: 'package',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  actor: describe({
    size: getActorShapeSize,
    render: (vm, { key, common }) => <ActorShape key={key} viewModel={vm} {...common} />,
    editor: 'openProps',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  useCase: describe({
    size: getUseCaseShapeSize,
    render: (vm, { key, common, onMouseEnter, onMouseLeave }) => (
      <UseCaseShape
        key={key}
        viewModel={vm}
        {...common}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    ),
    editor: 'useCaseModal',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  systemBoundary: describe({
    size: getSystemBoundaryShapeSize,
    render: (vm, { key, common, onResizeEnd, isDropTarget }) => (
      <SystemBoundaryShape
        key={key}
        viewModel={vm}
        {...common}
        onResizeEnd={onResizeEnd}
        isDropTarget={isDropTarget}
      />
    ),
    editor: 'openProps',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  ucModule: describe({
    size: getUCModuleShapeSize,
    render: (vm, { key, common, onResizeEnd, isDropTarget }) => (
      <UCModuleShape
        key={key}
        viewModel={vm}
        {...common}
        onResizeEnd={onResizeEnd}
        isDropTarget={isDropTarget}
      />
    ),
    editor: 'openProps',
    resize: 'ucModule',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  domainEntity: describe({
    size: getDomainEntityShapeSize,
    render: (vm, { key, common }) => <DomainEntityShape key={key} viewModel={vm} {...common} />,
    editor: 'openProps',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  lifeline: describe({
    size: getLifelineShapeSize,
    render: (vm, { key, common, onResizeEnd, onResetTimeline }) => (
      <LifelineShape
        key={key}
        viewModel={vm}
        {...common}
        onResizeEnd={onResizeEnd}
        onResetTimeline={onResetTimeline}
      />
    ),
    editor: 'lifelineOpenOrRename',
    resize: 'lifelineTimeline',
    draggable: true,
    // Slides along the header row with its Y pinned.
    dragAxis: 'horizontal',
    dragEnd: 'node',
    resetTimeline: true,
  }),

  message: describe({
    size: getMessageShapeSize,
    render: (vm, { key, common }) => <MessageShape key={key} viewModel={vm} {...common} />,
    editor: 'inlineRename',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'vertical',
    dragEnd: 'message',
    resetTimeline: false,
  }),

  activation: describe({
    size: getActivationShapeSize,
    // Activations are system-managed (no drag/resize): pass only the props the
    // lean shape uses rather than the full draggable `common` bundle.
    render: (vm, { key, common }) => (
      <ActivationShape
        key={key}
        viewModel={vm}
        x={common.x}
        y={common.y}
        selected={common.selected}
        opacity={common.opacity}
        visible={common.visible}
        onNodeClick={common.onNodeClick}
        onContextMenu={common.onContextMenu}
      />
    ),
    editor: 'openProps',
    resize: 'systemBoundary',
    // System-managed geometry: never dragged by hand.
    draggable: false,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  fragment: describe({
    size: getFragmentShapeSize,
    render: (vm, { key, common, onResizeEnd }) => (
      <FragmentShape key={key} viewModel={vm} {...common} onResizeEnd={onResizeEnd} />
    ),
    editor: 'fragmentPanel',
    resize: 'fragment',
    draggable: true,
    dragAxis: 'vertical',
    dragEnd: 'fragment',
    resetTimeline: false,
  }),

  stateInvariant: describe({
    size: getStateInvariantShapeSize,
    render: (vm, { key, common, onResizeEnd }) => (
      <StateInvariantShape key={key} viewModel={vm} {...common} onResizeEnd={onResizeEnd} />
    ),
    editor: 'stateInvariantPanel',
    resize: 'stateInvariant',
    draggable: true,
    dragAxis: 'vertical',
    dragEnd: 'derived',
    resetTimeline: false,
  }),

  interactionUse: describe({
    size: getInteractionUseShapeSize,
    render: (vm, { key, common, onResizeEnd }) => (
      <InteractionUseShape key={key} viewModel={vm} {...common} onResizeEnd={onResizeEnd} />
    ),
    editor: 'interactionUsePanel',
    resize: 'interactionUse',
    draggable: true,
    dragAxis: 'vertical',
    dragEnd: 'derived',
    resetTimeline: false,
  }),

  gate: describe({
    size: getGateShapeSize,
    render: (vm, { key, common }) => <GateShape key={key} viewModel={vm} {...common} />,
    editor: 'gatePanel',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'vertical',
    dragEnd: 'derived',
    resetTimeline: false,
  }),

  generalOrdering: describe({
    size: getGeneralOrderingShapeSize,
    render: (vm, { key, common }) => <GeneralOrderingShape key={key} viewModel={vm} {...common} />,
    editor: 'generalOrderingProps',
    resize: 'systemBoundary',
    // Fully-derived geometry, anchored to its occurrences.
    draggable: false,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  timeConstraint: describe({
    size: getTimeConstraintShapeSize,
    render: (vm, { key, common }) => <TimeConstraintShape key={key} viewModel={vm} {...common} />,
    editor: 'timeConstraintProps',
    resize: 'systemBoundary',
    draggable: false,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  coregion: describe({
    size: getCoregionShapeSize,
    render: (vm, { key, common }) => <CoregionShape key={key} viewModel={vm} {...common} />,
    editor: 'coregionProps',
    resize: 'systemBoundary',
    draggable: false,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  continuation: describe({
    size: getContinuationShapeSize,
    render: (vm, { key, common }) => <ContinuationShape key={key} viewModel={vm} {...common} />,
    editor: 'continuationProps',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'vertical',
    dragEnd: 'derived',
    resetTimeline: false,
  }),

  // ── Activity diagrams (A1) ────────────────────────────────────────────────
  // Free geometry, like class boxes: an activity node goes where the modeller
  // puts it. Nothing here is derived, so nothing is axis-locked.

  activityAction: describe({
    size: getActionShapeSize,
    render: (vm, { key, common }) => <ActionShape key={key} viewModel={vm} {...common} />,
    editor: 'inlineRename',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  activityControlNode: describe({
    size: getControlNodeShapeSize,
    render: (vm, { key, common }) => <ControlNodeShape key={key} viewModel={vm} {...common} />,
    // A filled circle has nothing to edit.
    editor: 'none',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  // ── Activity diagrams (A2) ────────────────────────────────────────────────

  activityDecision: describe({
    size: getDecisionShapeSize,
    render: (vm, { key, common }) => <DecisionShape key={key} viewModel={vm} {...common} />,
    // No label on the node — the branch condition lives on the edges (`guard`).
    editor: 'none',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  activityForkJoin: describe({
    size: getForkJoinShapeSize,
    render: (vm, { key, common }) => <ForkJoinShape key={key} viewModel={vm} {...common} />,
    editor: 'none',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  // ── Activity diagrams (A3) ────────────────────────────────────────────────
  // A swimlane is a band whose x is derived from the whole row (partitionLayout.ts),
  // not dragged — same reasoning as the package: it draws in its own layer,
  // outside the ShapeRouter path and the main render loop, and reorders through
  // its own header buttons instead of a drag gesture.
  activityPartition: describe({
    size: null,
    render: null,
    editor: 'none',
    resize: 'activityPartition',
    draggable: false,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  // ── Activity diagrams (A6/v1.1) ──────────────────────────────────────────
  // Same free-geometry reasoning as the action box; the classifier trace is
  // set through its own menu item, same pattern as the action's operation
  // trace (ADR-0010).
  activityObjectNode: describe({
    size: getObjectNodeShapeSize,
    render: (vm, { key, common }) => <ObjectNodeShape key={key} viewModel={vm} {...common} />,
    editor: 'inlineRename',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  // ── Activity diagrams (A6.2/v1.1) ────────────────────────────────────────
  // Input/output pin: created from its owner action's context menu, not
  // dragged from the palette (a pin with no owner means nothing), but once on
  // the canvas it is a free-floating node like the object node — same
  // rename-in-place, same "own menu item for the trace" pattern (ADR-0010).
  activityPin: describe({
    size: getPinShapeSize,
    render: (vm, { key, common }) => <PinShape key={key} viewModel={vm} {...common} />,
    editor: 'inlineRename',
    resize: 'systemBoundary',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),

  // ── Activity diagrams (structured nodes, v1.1) ──────────────────────────
  // Loop/conditional/sequence: unlike pins and object nodes, this one DOES
  // get a palette tool — an empty box is meaningful (drop it, then drop
  // children inside it) — and it DOES really resize, same Transformer
  // mechanic as the system boundary, with its own smaller minimum size.
  activityStructured: describe({
    size: getStructuredNodeShapeSize,
    render: (vm, { key, common, onResizeEnd, isDropTarget }) => (
      <StructuredNodeShape
        key={key}
        viewModel={vm}
        {...common}
        onResizeEnd={onResizeEnd}
        isDropTarget={isDropTarget}
      />
    ),
    editor: 'inlineRename',
    resize: 'activityStructured',
    draggable: true,
    dragAxis: 'free',
    dragEnd: 'node',
    resetTimeline: false,
  }),
};
