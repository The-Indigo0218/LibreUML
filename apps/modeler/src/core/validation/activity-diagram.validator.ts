import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';
import type { BaseValidator } from './base-validator.types';
import type { ValidationResult } from '../registry/diagram-registry.types';

const ok: ValidationResult = { isValid: true };

/** Node types that carry a user-facing name. Control nodes deliberately do not. */
const NAMED_TYPES = new Set(['ACTION', 'CALL_OPERATION', 'OBJECT_NODE', 'ACTIVITY_PARTITION']);

/** Nothing may flow out of a final node — it ends the flow (UML 2.5 §15.3). */
const TERMINAL_TYPES = new Set(['ACTIVITY_FINAL', 'FLOW_FINAL']);

/** Nothing may flow into an initial node — it starts the flow. */
const SOURCE_ONLY_TYPES = new Set(['INITIAL_NODE']);

const ACTIVITY_NODE_TYPES = new Set([
  'ACTION', 'CALL_OPERATION', 'INITIAL_NODE', 'ACTIVITY_FINAL',
  'DECISION', 'MERGE', 'FORK', 'JOIN', 'FLOW_FINAL', 'OBJECT_NODE',
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

    // An object flow carries a value, so at least one end should be an object
    // node. Warn rather than block: the modeller may be sketching.
    if (edgeType === 'OBJECT_FLOW'
      && sourceNode.type !== 'OBJECT_NODE'
      && targetNode.type !== 'OBJECT_NODE') {
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

    return warnings.length ? { isValid: true, warnings } : ok;
  }

  validateEdge(edge: DomainEdge, sourceNode: DomainNode, targetNode: DomainNode): ValidationResult {
    return this.validateConnection(sourceNode, targetNode, edge.type, undefined, undefined);
  }
}

export const activityDiagramValidator = new ActivityDiagramValidator();
