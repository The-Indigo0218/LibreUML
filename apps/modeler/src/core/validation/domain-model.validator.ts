import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';
import type { BaseValidator } from './base-validator.types';
import type { ValidationResult } from '../registry/diagram-registry.types';
import type { DomainEntityNode } from '../domain/models/nodes/domain-model.types';
import type { DomainAssociationEdge } from '../domain/models/edges/domain-model.types';
import { isValidMultiplicity } from '../domain/multiplicity.utils';

const ALLOWED_EDGE_TYPES = new Set(['ASSOCIATION', 'NOTE_LINK']);

export class DomainModelDiagramValidator implements BaseValidator {
  validateConnection(
    sourceNode: DomainNode,
    targetNode: DomainNode,
    edgeType: string,
    _existingEdges?: DomainEdge[],
    _allNodes?: Record<string, DomainNode>
  ): ValidationResult {
    // NOTE_LINK is always permitted (Notes have no IR backing element)
    if (edgeType === 'NOTE_LINK') {
      return { isValid: true };
    }

    if (!ALLOWED_EDGE_TYPES.has(edgeType)) {
      return {
        isValid: false,
        errors: [
          `Only ASSOCIATION is allowed in Domain Model diagrams (got: ${edgeType})`,
        ],
      };
    }

    if (sourceNode.type !== 'DOMAIN_ENTITY') {
      return {
        isValid: false,
        errors: [
          `Association source must be a Domain Entity (got: ${sourceNode.type})`,
        ],
      };
    }

    if (targetNode.type !== 'DOMAIN_ENTITY') {
      return {
        isValid: false,
        errors: [
          `Association target must be a Domain Entity (got: ${targetNode.type})`,
        ],
      };
    }

    return { isValid: true };
  }

  validateNode(
    node: DomainNode,
    allNodes?: DomainNode[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (node.type !== 'DOMAIN_ENTITY') {
      errors.push(`Unknown node type for Domain Model Diagram: ${node.type}`);
      return { isValid: false, errors };
    }

    const entity = node as DomainEntityNode;

    if (!entity.name || entity.name.trim() === '') {
      errors.push('Domain Entity name cannot be empty');
    } else if (allNodes) {
      const duplicate = allNodes.find(
        (n) =>
          n.id !== entity.id &&
          n.type === 'DOMAIN_ENTITY' &&
          'name' in n &&
          (n as DomainEntityNode).name.trim().toLowerCase() ===
            entity.name.trim().toLowerCase()
      );
      if (duplicate) {
        warnings.push(
          `Duplicate entity name "${entity.name}" in this diagram`
        );
      }
    }

    const seenAttrNames = new Set<string>();
    for (const attr of entity.attributes) {
      if (!attr.name || attr.name.trim() === '') {
        errors.push('Attribute name cannot be empty');
        continue;
      }
      const key = attr.name.trim().toLowerCase();
      if (seenAttrNames.has(key)) {
        errors.push(`Duplicate attribute name "${attr.name}" in entity "${entity.name}"`);
      } else {
        seenAttrNames.add(key);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  validateEdge(
    edge: DomainEdge,
    _sourceNode: DomainNode,
    _targetNode: DomainNode
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (edge.type !== 'ASSOCIATION') {
      return { isValid: true };
    }

    const assoc = edge as DomainAssociationEdge;

    if (!assoc.label || assoc.label.trim() === '') {
      errors.push('Association must have a verb label describing the relationship');
    }

    if ('sourceMultiplicity' in assoc && !isValidMultiplicity(assoc.sourceMultiplicity)) {
      warnings.push(`Source multiplicity "${assoc.sourceMultiplicity}" is not a standard UML multiplicity`);
    }

    if ('targetMultiplicity' in assoc && !isValidMultiplicity(assoc.targetMultiplicity)) {
      warnings.push(`Target multiplicity "${assoc.targetMultiplicity}" is not a standard UML multiplicity`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}

export const domainModelDiagramValidator = new DomainModelDiagramValidator();
