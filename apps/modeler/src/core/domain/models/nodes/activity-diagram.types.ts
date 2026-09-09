import type { BaseDomainNode, Documentable } from './base.types';
import type { ActivityNodeKind } from '../../vfs/vfs.types';

/**
 * Activity diagram node types (A1).
 *
 * These mirror `IRActivityNode.activityType` one-to-one, but stay a separate
 * union because the domain-node layer is what the registry, the tools and the
 * validator speak — the IR is the persisted form.
 */
export type ActivityDiagramNodeType =
  | 'ACTION'
  | 'CALL_OPERATION'
  | 'INITIAL_NODE'
  | 'ACTIVITY_FINAL'
  | 'DECISION'
  | 'MERGE'
  | 'FORK'
  | 'JOIN'
  | 'FLOW_FINAL'
  | 'OBJECT_NODE'
  | 'INPUT_PIN'
  | 'OUTPUT_PIN'
  | 'LOOP_NODE'
  | 'CONDITIONAL_NODE'
  | 'SEQUENCE_NODE'
  | 'INTERRUPTIBLE_REGION'
  | 'EXPANSION_REGION'
  | 'INPUT_EXPANSION_NODE'
  | 'OUTPUT_EXPANSION_NODE'
  | 'ACTIVITY_PARTITION'
  | 'NOTE';

/** A step in the flow. `CALL_OPERATION` carries the trace to an operation. */
export interface ActionNode extends BaseDomainNode, Documentable {
  type: 'ACTION' | 'CALL_OPERATION';
  name: string;
  activityId: string;
  partitionId?: string;
  /** CALL_OPERATION only (ADR-0010). */
  callsOperationId?: string;
}

/**
 * Initial, final and flow-final markers. They carry no name of their own —
 * a filled circle is its own label.
 */
export interface ControlNode extends BaseDomainNode {
  type: 'INITIAL_NODE' | 'ACTIVITY_FINAL' | 'FLOW_FINAL';
  activityId: string;
  partitionId?: string;
}

/** Diamond: one in, many out (DECISION) or many in, one out (MERGE). */
export interface DecisionNode extends BaseDomainNode, Documentable {
  type: 'DECISION' | 'MERGE';
  activityId: string;
  partitionId?: string;
}

/** Bar: splits flow into concurrent branches (FORK) or waits for them (JOIN). */
export interface BarNode extends BaseDomainNode {
  type: 'FORK' | 'JOIN';
  activityId: string;
  partitionId?: string;
  barOrientation?: 'HORIZONTAL' | 'VERTICAL';
}

/** An object flowing between actions (v1.1). */
export interface ObjectFlowNode extends BaseDomainNode, Documentable {
  type: 'OBJECT_NODE';
  name: string;
  activityId: string;
  partitionId?: string;
  classifierId?: string;
}

/**
 * An input or output pin on an action (A6.2/v1.1). Owned by exactly one
 * action — `ownerActionId` — and optionally traces to a parameter of that
 * action's linked operation (ADR-0010).
 */
export interface PinNode extends BaseDomainNode, Documentable {
  type: 'INPUT_PIN' | 'OUTPUT_PIN';
  name: string;
  activityId: string;
  ownerActionId?: string;
  parameterName?: string;
}

/**
 * An expansion node (v1.1) — the boundary square where a collection enters or
 * a per-element result leaves an EXPANSION_REGION. Same ownership shape as
 * `PinNode` one level up (a region instead of an action, `ownerRegionId`
 * instead of `ownerActionId`), and it reuses the object node's `classifierId`
 * trace rather than inventing a third ADR-0010 trace shape — there is no
 * "parameter" to link here, but "classifier of the element that flows" is
 * exactly the same concept an object node already has.
 */
export interface ExpansionNode extends BaseDomainNode, Documentable {
  type: 'INPUT_EXPANSION_NODE' | 'OUTPUT_EXPANSION_NODE';
  name: string;
  activityId: string;
  ownerRegionId?: string;
  classifierId?: string;
}

/**
 * A structured activity node — loop, conditional, sequence, an interruptible
 * region, or an expansion region (v1.1). Groups other activity nodes
 * (`containerId` on the children) without modelling the real UML sub-regions
 * (setup/test/body for a loop, per-clause test+body for a conditional): a
 * single free-text `testExpression` stands in for all of that, same
 * conformance scope cut as guard/weight on `IRRelation` — unused for
 * SEQUENCE_NODE/INTERRUPTIBLE_REGION/EXPANSION_REGION, none of which has
 * anything to test. Unlike a partition, it is a free-floating resizable
 * container, not a row in a fixed axis — same containment mechanism as a
 * package (`parentPackageId` at the view level, `containerId` at the model
 * level for the semantic side).
 *
 * INTERRUPTIBLE_REGION is UML's `ActivityGroup`, not really a
 * `StructuredActivityNode` subtype — collapsed into this same shape/mechanism
 * deliberately (same conformance cut as the rest of this file): its dashed
 * boundary is the real UML notation for the construct, so nothing about the
 * visual is a compromise, only the metamodel classification underneath it.
 * EXPANSION_REGION, unlike the interruptible region, *is* a real
 * `StructuredActivityNode` subtype in UML — no classification cut needed for
 * it, only the usual flat-body one every kind in this file already takes.
 */
export interface StructuredActivityNode extends BaseDomainNode, Documentable {
  type:
    | 'LOOP_NODE' | 'CONDITIONAL_NODE' | 'SEQUENCE_NODE' | 'INTERRUPTIBLE_REGION'
    | 'EXPANSION_REGION';
  name: string;
  activityId: string;
  partitionId?: string;
  containerId?: string;
  /** LOOP_NODE/CONDITIONAL_NODE only. */
  testExpression?: string;
  /** EXPANSION_REGION only. Defaults to PARALLEL when unset. */
  mode?: 'PARALLEL' | 'ITERATIVE' | 'STREAM';
}

/** A swimlane (A3). Ordering comes from `index`, never from pixels (ADR-0008). */
export interface ActivityPartitionNode extends BaseDomainNode, Documentable {
  type: 'ACTIVITY_PARTITION';
  name: string;
  activityId: string;
  index: number;
  representsId?: string;
}

export type ActivityDiagramNode =
  | ActionNode
  | ControlNode
  | DecisionNode
  | BarNode
  | ObjectFlowNode
  | PinNode
  | ExpansionNode
  | StructuredActivityNode
  | ActivityPartitionNode;

export type { ActivityNodeKind };

/**
 * Domain node type → the `activityType` persisted on the IR. `INITIAL_NODE` is
 * the one that differs: `INITIAL` reads badly as a domain node type next to
 * `ACTION`, but the IR follows UML's spelling.
 */
export const ACTIVITY_NODE_TYPE_TO_IR: Record<string, ActivityNodeKind> = {
  ACTION: 'ACTION',
  CALL_OPERATION: 'CALL_OPERATION',
  INITIAL_NODE: 'INITIAL',
  ACTIVITY_FINAL: 'ACTIVITY_FINAL',
  DECISION: 'DECISION',
  MERGE: 'MERGE',
  FORK: 'FORK',
  JOIN: 'JOIN',
  FLOW_FINAL: 'FLOW_FINAL',
  OBJECT_NODE: 'OBJECT_NODE',
  INPUT_PIN: 'INPUT_PIN',
  OUTPUT_PIN: 'OUTPUT_PIN',
  LOOP_NODE: 'LOOP_NODE',
  CONDITIONAL_NODE: 'CONDITIONAL_NODE',
  SEQUENCE_NODE: 'SEQUENCE_NODE',
  INTERRUPTIBLE_REGION: 'INTERRUPTIBLE_REGION',
  EXPANSION_REGION: 'EXPANSION_REGION',
  INPUT_EXPANSION_NODE: 'INPUT_EXPANSION_NODE',
  OUTPUT_EXPANSION_NODE: 'OUTPUT_EXPANSION_NODE',
};

/** The inverse of `ACTIVITY_NODE_TYPE_TO_IR`. */
export const IR_TO_ACTIVITY_NODE_TYPE: Record<ActivityNodeKind, string> = Object.fromEntries(
  Object.entries(ACTIVITY_NODE_TYPE_TO_IR).map(([domain, ir]) => [ir, domain]),
) as Record<ActivityNodeKind, string>;
