import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';
import type { BaseValidator } from './base-validator.types';
import type { ValidationResult } from '../registry/diagram-registry.types';
import type { LifelineNode } from '../domain/models/nodes/sequence-diagram.types';

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
    // Fase 1: no per-edge rules. Operation/argument checks land in Fase 2.
    return { isValid: true };
  }
}

export const sequenceDiagramValidator = new SequenceDiagramValidator();
