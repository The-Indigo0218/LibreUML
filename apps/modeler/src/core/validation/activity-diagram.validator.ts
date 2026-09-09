import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';
import type { BaseValidator } from './base-validator.types';
import type { ValidationResult } from '../registry/diagram-registry.types';
import type { SemanticModel } from '../domain/vfs/vfs.types';

const ok: ValidationResult = { isValid: true };

/** Node types that carry a user-facing name. Control nodes deliberately do not. */
const NAMED_TYPES = new Set([
  'ACTION', 'CALL_OPERATION', 'OBJECT_NODE', 'ACTIVITY_PARTITION',
  'LOOP_NODE', 'CONDITIONAL_NODE', 'SEQUENCE_NODE', 'INTERRUPTIBLE_REGION',
  'EXPANSION_REGION',
]);

/** LOOP_NODE/CONDITIONAL_NODE only — SEQUENCE_NODE has nothing to test. */
const TESTABLE_STRUCTURED_TYPES = new Set(['LOOP_NODE', 'CONDITIONAL_NODE']);

/** Nothing may flow out of a final node — it ends the flow (UML 2.5 §15.3). */
const TERMINAL_TYPES = new Set(['ACTIVITY_FINAL', 'FLOW_FINAL']);

/** Nothing may flow into an initial node — it starts the flow. */
const SOURCE_ONLY_TYPES = new Set(['INITIAL_NODE']);

const ACTIVITY_NODE_TYPES = new Set([
  'ACTION', 'CALL_OPERATION', 'INITIAL_NODE', 'ACTIVITY_FINAL',
  'DECISION', 'MERGE', 'FORK', 'JOIN', 'FLOW_FINAL', 'OBJECT_NODE',
  'INPUT_PIN', 'OUTPUT_PIN',
  // A structured node participates in control flow as a single step, same as
  // an action — flow enters/exits it as a whole (v1.1).
  'LOOP_NODE', 'CONDITIONAL_NODE', 'SEQUENCE_NODE', 'INTERRUPTIBLE_REGION',
  'EXPANSION_REGION', 'INPUT_EXPANSION_NODE', 'OUTPUT_EXPANSION_NODE',
]);

/** Handler body types a well-formed exception handler should target (v1.1). */
const HANDLER_BODY_TYPES = new Set(['ACTION', 'CALL_OPERATION']);

/**
 * An object flow terminating here carries a value, same as an object node
 * (A6.2). Unlike a pin, an expansion node is deliberately NOT direction-
 * restricted below — real UML has it carrying flow both ways at once (the
 * whole collection in/out at the boundary, per-element values in/out on the
 * inside), so forcing the pin's one-way rule onto it would be modelling a
 * restriction that does not actually exist, not a useful conformance cut.
 */
const OBJECT_FLOW_ENDPOINT_TYPES = new Set([
  'OBJECT_NODE', 'INPUT_PIN', 'OUTPUT_PIN', 'INPUT_EXPANSION_NODE', 'OUTPUT_EXPANSION_NODE',
]);

/**
 * Activity diagram rules (A1).
 *
 * Scope is v1: control flow between activity nodes. Object flow typing and
 * partition-crossing rules arrive with A2/A3.
 *
 * These reach the Problems Panel as well as the connection gesture (ADR-0013),
 * so severity matters: anything that is merely unusual belongs in `warnings`,
 * not `errors`.
 */
export class ActivityDiagramValidator implements BaseValidator {
  validateConnection(
    sourceNode: DomainNode,
    targetNode: DomainNode,
    edgeType: string,
    _existingEdges?: DomainEdge[],
    _allNodes?: Record<string, DomainNode>,
  ): ValidationResult {
    // Exception handler (v1.1): protectedNode → handlerBody, own rules —
    // kept out of the CONTROL_FLOW/OBJECT_FLOW branch below since it isn't a
    // flow at all (no terminal/initial/self-loop reasoning applies the same way).
    if (edgeType === 'EXCEPTION_HANDLER') {
      if (!ACTIVITY_NODE_TYPES.has(sourceNode.type)) {
        return { isValid: false, errors: ['An exception handler must protect an activity node'] };
      }
      if (sourceNode.id === targetNode.id) {
        return { isValid: false, errors: ['A node cannot handle its own exception'] };
      }
      if (!HANDLER_BODY_TYPES.has(targetNode.type)) {
        return { isValid: true, warnings: ['An exception handler body is usually an action'] };
      }
      return ok;
    }

    if (edgeType !== 'CONTROL_FLOW' && edgeType !== 'OBJECT_FLOW') {
      return { isValid: false, errors: [`Unsupported flow type: ${edgeType}`] };
    }

    if (!ACTIVITY_NODE_TYPES.has(sourceNode.type)) {
      return { isValid: false, errors: ['A flow must start at an activity node'] };
    }
    if (!ACTIVITY_NODE_TYPES.has(targetNode.type)) {
      return { isValid: false, errors: ['A flow must end at an activity node'] };
    }

    if (TERMINAL_TYPES.has(sourceNode.type)) {
      return { isValid: false, errors: ['A final node ends the flow — nothing can leave it'] };
    }
    if (SOURCE_ONLY_TYPES.has(targetNode.type)) {
      return { isValid: false, errors: ['An initial node starts the flow — nothing can enter it'] };
    }

    if (sourceNode.id === targetNode.id) {
      return { isValid: false, errors: ['A node cannot flow into itself'] };
    }

    // A pin has a direction (A6.2): a value only ever leaves an input pin's
    // owner through it backwards, never out of the pin itself, and never
    // into an output pin. Checked before the generic object-node-at-one-end
    // rule below so a pin-to-pin flow gets the more specific message.
    if (edgeType === 'OBJECT_FLOW' && sourceNode.type === 'INPUT_PIN') {
      return {
        isValid: true,
        warnings: ['An input pin receives a value — nothing should flow out of it'],
      };
    }
    if (edgeType === 'OBJECT_FLOW' && targetNode.type === 'OUTPUT_PIN') {
      return {
        isValid: true,
        warnings: ['An output pin produces a value — nothing should flow into it'],
      };
    }

    // An object flow carries a value, so at least one end should be an object
    // node or a pin. Warn rather than block: the modeller may be sketching.
    if (edgeType === 'OBJECT_FLOW'
      && !OBJECT_FLOW_ENDPOINT_TYPES.has(sourceNode.type)
      && !OBJECT_FLOW_ENDPOINT_TYPES.has(targetNode.type)) {
      return {
        isValid: true,
        warnings: ['An object flow usually has an object node at one end'],
      };
    }

    return ok;
  }

  validateNode(node: DomainNode): ValidationResult {
    if (!ACTIVITY_NODE_TYPES.has(node.type) && node.type !== 'ACTIVITY_PARTITION') return ok;

    const warnings: string[] = [];

    if (NAMED_TYPES.has(node.type)) {
      const name = (node as { name?: string }).name;
      if (!name || !name.trim()) {
        warnings.push('This node has no name');
      }
    }

    // A traced call that points nowhere is worse than an untraced one: it looks
    // connected to the model and is not (ADR-0010).
    if (node.type === 'CALL_OPERATION' && !(node as { callsOperationId?: string }).callsOperationId) {
      warnings.push('This call action does not reference an operation');
    }

    // A pin with no owner (A6.2) is structurally broken — it can only exist
    // through the "Add Input/Output Pin" menu item, which always sets one.
    if ((node.type === 'INPUT_PIN' || node.type === 'OUTPUT_PIN')
      && !(node as { ownerActionId?: string }).ownerActionId) {
      warnings.push('This pin has no owning action');
    }

    // Same reasoning one level up: an expansion node (v1.1) only exists
    // through its region's "Add Input/Output Expansion Node" menu item.
    if ((node.type === 'INPUT_EXPANSION_NODE' || node.type === 'OUTPUT_EXPANSION_NODE')
      && !(node as { ownerRegionId?: string }).ownerRegionId) {
      warnings.push('This expansion node has no owning region');
    }

    // A loop/conditional with no test reads as unconditional — probably not
    // what the modeller meant to draw (structured nodes, v1.1).
    if (TESTABLE_STRUCTURED_TYPES.has(node.type)
      && !(node as { testExpression?: string }).testExpression?.trim()) {
      warnings.push('This node has no test condition');
    }

    return warnings.length ? { isValid: true, warnings } : ok;
  }

  validateEdge(edge: DomainEdge, sourceNode: DomainNode, targetNode: DomainNode): ValidationResult {
    return this.validateConnection(sourceNode, targetNode, edge.type, undefined, undefined);
  }

  /**
   * Fan-out/fan-in rules for decision, merge, fork and join (A2). These need
   * every CONTROL_FLOW/OBJECT_FLOW relation touching a node, which the
   * BaseValidator interface never hands a single node at a time — same
   * reasoning as SequenceDiagramValidator.validateMessage(). Not wired to the
   * Problems Panel yet (that cabling is A5, §16); exercised directly by tests
   * for now.
   */
  validateActivityStructure(activityId: string, model: SemanticModel): ValidationResult {
    const warnings: string[] = [];
    const nodes = Object.values(model.activityNodes ?? {}).filter(
      (n) => n.activityId === activityId,
    );
    const flows = Object.values(model.relations ?? {}).filter(
      (r) => r.kind === 'CONTROL_FLOW' || r.kind === 'OBJECT_FLOW',
    );
    const outgoing = (id: string) => flows.filter((r) => r.sourceId === id).length;
    const incoming = (id: string) => flows.filter((r) => r.targetId === id).length;

    // A fork with no join anywhere in the activity never rejoins the
    // concurrent flows it opens — checked once per activity, not per node.
    if (nodes.some((n) => n.activityType === 'FORK') && !nodes.some((n) => n.activityType === 'JOIN')) {
      warnings.push('This activity forks concurrent flows but never joins them back');
    }

    for (const node of nodes) {
      const label = node.name?.trim() || node.id;
      if (node.activityType === 'DECISION' && outgoing(node.id) < 2) {
        warnings.push(`Decision "${label}" has only one outgoing flow — nothing to branch on`);
      }
      if (node.activityType === 'FORK' && outgoing(node.id) < 2) {
        warnings.push(`Fork "${label}" has only one outgoing flow — nothing to run concurrently`);
      }
      if (node.activityType === 'MERGE' && incoming(node.id) < 2) {
        warnings.push(`Merge "${label}" has only one incoming flow — nothing to rejoin`);
      }
      if (node.activityType === 'JOIN' && incoming(node.id) < 2) {
        warnings.push(`Join "${label}" has only one incoming flow — nothing to synchronize`);
      }
      // An expansion region with no input expansion node has no collection to
      // iterate over — same "fan" reasoning as decision/fork above, just
      // measured over ownership (`ownerRegionId`) instead of flow (v1.1).
      if (node.activityType === 'EXPANSION_REGION'
        && !nodes.some((n) => n.ownerRegionId === node.id && n.activityType === 'INPUT_EXPANSION_NODE')) {
        warnings.push(`Expansion region "${label}" has no input expansion node`);
      }
    }

    // Interrupting edge (v1.1, UML 2.5 §15.3): must actually leave an
    // INTERRUPTIBLE_REGION — needs containerId on both endpoints, which only
    // this model-wide view has (BaseValidator's per-edge validateEdge never
    // sees more than the two endpoints).
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    for (const flow of flows) {
      if (!(flow as { isInterrupting?: boolean }).isInterrupting) continue;
      const source = nodeById.get(flow.sourceId);
      if (!source) continue;
      const region = source.containerId ? nodeById.get(source.containerId) : undefined;
      if (!region || region.activityType !== 'INTERRUPTIBLE_REGION') {
        warnings.push('This interrupting flow does not leave an interruptible region');
        continue;
      }
      const target = nodeById.get(flow.targetId);
      if (target && target.containerId === source.containerId) {
        warnings.push('This interrupting flow never actually leaves its interruptible region');
      }
    }

    return warnings.length ? { isValid: true, warnings } : ok;
  }
}

export const activityDiagramValidator = new ActivityDiagramValidator();
