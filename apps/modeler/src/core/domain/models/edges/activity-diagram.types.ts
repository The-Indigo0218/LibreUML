import type { BaseDomainEdge, Labelable } from './base.types';

export type ActivityDiagramEdgeType = 'CONTROL_FLOW' | 'OBJECT_FLOW';

/**
 * Guard and weight are properties of the flow, not of the node it leaves —
 * the same action can branch on different conditions (spec section 3).
 */
interface ActivityFlowProps {
  /** e.g. '[balance > 0]'. Rendered next to the arrow. */
  guard?: string;
  /** '*', '1', or an expression. Defaults to 1 when absent. */
  weight?: string;
}

/** Sequencing between two activity nodes: when this finishes, that starts. */
export interface ControlFlowEdge extends BaseDomainEdge, Labelable, ActivityFlowProps {
  type: 'CONTROL_FLOW';
}

/** A flow that also carries a value between object nodes (v1.1). */
export interface ObjectFlowEdge extends BaseDomainEdge, Labelable, ActivityFlowProps {
  type: 'OBJECT_FLOW';
}

export type ActivityDiagramEdge = ControlFlowEdge | ObjectFlowEdge;
