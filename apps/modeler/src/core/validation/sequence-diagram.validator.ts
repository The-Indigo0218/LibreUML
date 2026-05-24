import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';
import type { BaseValidator } from './base-validator.types';
import type { ValidationResult } from '../registry/diagram-registry.types';
import type { LifelineNode } from '../domain/models/nodes/sequence-diagram.types';
import type {
  SemanticModel,
  IRMessage,
  IRClass,
  IRInterface,
} from '../domain/vfs/vfs.types';

export class SequenceDiagramValidator implements BaseValidator {
  validateConnection(
    sourceNode: DomainNode,
    targetNode: DomainNode,
    edgeType: string,
    _existingEdges?: DomainEdge[],
    _allNodes?: Record<string, DomainNode>
  ): ValidationResult {
    if (sourceNode.type !== 'LIFELINE') {
      return { isValid: false, errors: ['Message source must be a Lifeline'] };
    }
    if (targetNode.type !== 'LIFELINE') {
      return { isValid: false, errors: ['Message target must be a Lifeline'] };
    }

    switch (edgeType) {
      case 'MESSAGE_SYNC':
      case 'MESSAGE_ASYNC':
      case 'MESSAGE_REPLY':
        return { isValid: true };
      default:
        return {
          isValid: false,
          errors: [`Unknown edge type for Sequence Diagram: ${edgeType}`],
        };
    }
  }

  validateNode(node: DomainNode): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (node.type) {
      case 'LIFELINE':
        this.validateLifelineNode(node as LifelineNode, errors, warnings);
        break;
      case 'NOTE':
        // Notes have no domain-level validation rules.
        break;
      default:
        errors.push(`Unknown node type for Sequence Diagram: ${node.type}`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private validateLifelineNode(node: LifelineNode, errors: string[], warnings: string[]): void {
    if (node.participantKind === 'ANONYMOUS') {
      if (!node.alias || node.alias.trim() === '') {
        errors.push('Anonymous lifeline must have an alias');
      }
    } else if (!node.represents) {
      errors.push(
        `Lifeline of kind ${node.participantKind} must reference an existing element (represents)`,
      );
    }

    if (!node.name || node.name.trim() === '') {
      warnings.push('Lifeline has no display name');
    }
  }

  validateEdge(
    _edge: DomainEdge,
    _sourceNode: DomainNode,
    _targetNode: DomainNode,
  ): ValidationResult {
    // BaseValidator-compatible stub. Sequence-specific edge checks live in
    // validateMessage(), which needs the full SemanticModel (the BaseValidator
    // signature only exposes the two endpoint DomainNodes).
    return { isValid: true };
  }

  /**
   * Sequence-diagram-specific message validation. Reasons this can't live in
   * validateEdge: resolving `operationId` requires walking from the target
   * lifeline's `represents` to its IRClass/IRInterface and inspecting
   * `operationIds`, which the BaseValidator interface doesn't pass in.
   *
   * Returns warnings (never errors) — these are linter-level hints, never
   * block the UI from creating the message.
   */
  validateMessage(message: IRMessage, model: SemanticModel): ValidationResult {
    const warnings: string[] = [];

    const tgtLifeline = model.lifelines?.[message.targetLifelineId];
    if (!tgtLifeline) {
      // Caller should have already rejected dangling refs; nothing to validate.
      return { isValid: true };
    }

    if (message.operationId) {
      const opOwner = resolveOperationOwner(model, tgtLifeline.represents);
      if (!opOwner) {
        warnings.push(
          `Message references operationId "${message.operationId}" but the target lifeline has no resolvable classifier`,
        );
      } else if (!opOwner.operationIds.includes(message.operationId)) {
        warnings.push(
          `Operation "${message.operationId}" is not declared on the target classifier "${opOwner.name}"`,
        );
      }
    }

    if (message.messageKind === 'REPLY' && !message.inReplyTo) {
      warnings.push('REPLY message has no inReplyTo set — no SYNC will be closed by it');
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}

/**
 * Returns the IRClass / IRInterface that owns the operations for a given
 * `represents` id, or null if the target is not a classifier (e.g. ACTOR).
 */
function resolveOperationOwner(
  model: SemanticModel,
  representsId: string | undefined,
): IRClass | IRInterface | null {
  if (!representsId) return null;
  if (model.classes[representsId]) return model.classes[representsId];
  if (model.interfaces[representsId]) return model.interfaces[representsId];
  return null;
}

export const sequenceDiagramValidator = new SequenceDiagramValidator();
