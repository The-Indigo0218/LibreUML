import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';
import type { DiagramValidator, ValidationResult } from '../registry/diagram-registry.types';
import type {
  ActorNode,
  UseCaseNode,
  SystemBoundaryNode,
} from '../domain/models/nodes/use-case.types';
import type { UseCaseDiagramEdge } from '../domain/models/edges/use-case.types';

/**
 * Use Case Diagram Validator
 * Implements UML 2.5 validation rules for Use Case Diagrams.
 */
export class UseCaseDiagramValidator implements DiagramValidator {
  /**
   * Validates if a connection between two nodes is allowed.
   * 
   * Rules:
   * - ASSOCIATION: Actor ↔ Use Case (bidirectional)
   * - INCLUDE: Use Case → Use Case
   * - EXTEND: Use Case → Use Case
   * - GENERALIZATION: Actor → Actor OR Use Case → Use Case
   * - INVALID: Actor → System Boundary, System Boundary → anything
   */
  validateConnection(
    sourceNode: DomainNode,
    targetNode: DomainNode,
    edgeType: string
  ): ValidationResult {
    const sourceType = sourceNode.type;
    const targetType = targetNode.type;

    // System Boundary cannot be source or target of connections
    if (sourceType === 'SYSTEM_BOUNDARY') {
      return {
        isValid: false,
        errors: ['System Boundary cannot be the source of a connection'],
      };
    }

    if (targetType === 'SYSTEM_BOUNDARY') {
      return {
        isValid: false,
        errors: ['System Boundary cannot be the target of a connection'],
      };
    }

    // Validate based on edge type
    switch (edgeType) {
      case 'ASSOCIATION':
        return this.validateAssociation(sourceNode, targetNode);
      
      case 'INCLUDE':
        return this.validateInclude(sourceNode, targetNode);
      
      case 'EXTEND':
        return this.validateExtend(sourceNode, targetNode);
      
      case 'GENERALIZATION':
        return this.validateGeneralization(sourceNode, targetNode);
      
      default:
        return {
          isValid: false,
          errors: [`Unknown edge type for Use Case Diagram: ${edgeType}`],
        };
    }
  }

  /**
   * Validates Association relationships.
   * Rules:
   * - Actor can associate with Use Case
   * - Use Case can associate with Actor
   * - Actor CANNOT associate with Actor (use Generalization)
   * - Use Case CANNOT associate with Use Case (use Include/Extend)
   */
  private validateAssociation(
    sourceNode: DomainNode,
    targetNode: DomainNode
  ): ValidationResult {
    const sourceType = sourceNode.type;
    const targetType = targetNode.type;

    // Actor ↔ Use Case
    if (
      (sourceType === 'ACTOR' && targetType === 'USE_CASE') ||
      (sourceType === 'USE_CASE' && targetType === 'ACTOR')
    ) {
      return { isValid: true };
    }

    // Actor → Actor is invalid (should use Generalization)
    if (sourceType === 'ACTOR' && targetType === 'ACTOR') {
      return {
        isValid: false,
        errors: ['Use Generalization for Actor-to-Actor relationships'],
      };
    }

    // Use Case → Use Case is invalid (should use Include/Extend)
    if (sourceType === 'USE_CASE' && targetType === 'USE_CASE') {
      return {
        isValid: false,
        errors: ['Use Include or Extend for Use Case-to-Use Case relationships'],
      };
    }

    return {
      isValid: false,
      errors: [`Invalid Association: ${sourceType} → ${targetType}`],
    };
  }

  /**
   * Validates Include relationships.
   * Rules:
   * - Only Use Case → Use Case
   * - Represents mandatory inclusion of behavior
   */
  private validateInclude(
    sourceNode: DomainNode,
    targetNode: DomainNode
  ): ValidationResult {
    const sourceType = sourceNode.type;
    const targetType = targetNode.type;

    if (sourceType !== 'USE_CASE') {
      return {
        isValid: false,
        errors: ['Include relationship source must be a Use Case'],
      };
    }

    if (targetType !== 'USE_CASE') {
      return {
        isValid: false,
        errors: ['Include relationship target must be a Use Case'],
      };
    }

    return { isValid: true };
  }

  /**
   * Validates Extend relationships.
   * Rules:
   * - Only Use Case → Use Case
   * - Represents optional extension of behavior
   */
  private validateExtend(
    sourceNode: DomainNode,
    targetNode: DomainNode
  ): ValidationResult {
    const sourceType = sourceNode.type;
    const targetType = targetNode.type;

    if (sourceType !== 'USE_CASE') {
      return {
        isValid: false,
        errors: ['Extend relationship source must be a Use Case'],
      };
    }

    if (targetType !== 'USE_CASE') {
      return {
        isValid: false,
        errors: ['Extend relationship target must be a Use Case'],
      };
    }

    return { isValid: true };
  }

  /**
   * Validates Generalization relationships.
   * Rules:
   * - Actor → Actor (actor inheritance)
   * - Use Case → Use Case (use case inheritance)
   * - CANNOT mix types (Actor → Use Case is invalid)
   */
  private validateGeneralization(
    sourceNode: DomainNode,
    targetNode: DomainNode
  ): ValidationResult {
    const sourceType = sourceNode.type;
    const targetType = targetNode.type;

    // Actor → Actor
    if (sourceType === 'ACTOR' && targetType === 'ACTOR') {
      return { isValid: true };
    }

    // Use Case → Use Case
    if (sourceType === 'USE_CASE' && targetType === 'USE_CASE') {
      return { isValid: true };
    }

    // Mixed types are invalid
    return {
      isValid: false,
      errors: [
        `Generalization must be between same types (Actor → Actor or Use Case → Use Case), not ${sourceType} → ${targetType}`,
      ],
    };
  }

  /**
   * Validates a node's domain data.
   * 
   * Rules:
   * - Actor name must not be empty
   * - Use Case name must not be empty
   * - System Boundary name must not be empty
   */
  validateNode(node: DomainNode): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Type-specific validation
    switch (node.type) {
      case 'ACTOR':
        this.validateActorNode(node as ActorNode, errors, warnings);
        break;
      
      case 'USE_CASE':
        this.validateUseCaseNode(node as UseCaseNode, errors, warnings);
        break;
      
      case 'SYSTEM_BOUNDARY':
        this.validateSystemBoundaryNode(node as SystemBoundaryNode, errors, warnings);
        break;
      
      default:
        errors.push(`Unknown node type for Use Case Diagram: ${node.type}`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validates Actor nodes.
   */
  private validateActorNode(
    node: ActorNode,
    errors: string[],
    warnings: string[]
  ): void {
    // Name validation
    if (!node.name || node.name.trim() === '') {
      errors.push('Actor name cannot be empty');
    }

    // Check for reasonable name length
    if (node.name && node.name.length > 50) {
      warnings.push('Actor name is very long (consider shortening)');
    }

    // Documentation check
    if (!node.documentation || node.documentation.trim() === '') {
      warnings.push('Actor has no documentation (consider adding a description)');
    }
  }

  /**
   * Validates Use Case nodes.
   */
  private validateUseCaseNode(
    node: UseCaseNode,
    errors: string[],
    warnings: string[]
  ): void {
    // Name validation
    if (!node.name || node.name.trim() === '') {
      errors.push('Use Case name cannot be empty');
    }

    // Use Case names should typically be verb phrases
    if (node.name && node.name.length > 0) {
      const firstChar = node.name.charAt(0);
      if (firstChar === firstChar.toLowerCase()) {
        warnings.push('Use Case names typically start with a capital letter');
      }
    }

    // Description check
    if (!node.description || node.description.trim() === '') {
      warnings.push('Use Case has no description (consider adding one)');
    }

    // Extension points validation
    if (node.extensionPoints && node.extensionPoints.length > 0) {
      node.extensionPoints.forEach((point, index) => {
        if (!point || point.trim() === '') {
          warnings.push(`Extension point at index ${index} is empty`);
        }
      });
    }
  }

  /**
   * Validates System Boundary nodes.
   */
  private validateSystemBoundaryNode(
    node: SystemBoundaryNode,
    errors: string[],
    warnings: string[]
  ): void {
    // Name validation
    if (!node.name || node.name.trim() === '') {
      errors.push('System Boundary name cannot be empty');
    }

    // Check if it contains use cases
    if (!node.containedUseCaseIds || node.containedUseCaseIds.length === 0) {
      warnings.push('System Boundary contains no Use Cases');
    }
  }

  /**
   * Validates an edge's domain data.
   * 
   * Rules:
   * - Source and target node IDs must exist
   * - Edge type must be valid for Use Case Diagrams
   */
  validateEdge(
    edge: DomainEdge,
    sourceNode: DomainNode,
    targetNode: DomainNode
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate edge type is a Use Case Diagram edge
    const validEdgeTypes = ['ASSOCIATION', 'INCLUDE', 'EXTEND', 'GENERALIZATION'];

    if (!validEdgeTypes.includes(edge.type)) {
      errors.push(`Invalid edge type for Use Case Diagram: ${edge.type}`);
    }

    // Extend-specific validation
    if (edge.type === 'EXTEND') {
      const extendEdge = edge as UseCaseDiagramEdge;
      if ('condition' in extendEdge && (!extendEdge.condition || extendEdge.condition.trim() === '')) {
        warnings.push('Extend relationship has no condition specified');
      }
      if ('extensionPoint' in extendEdge && (!extendEdge.extensionPoint || extendEdge.extensionPoint.trim() === '')) {
        warnings.push('Extend relationship has no extension point specified');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}

/**
 * Singleton instance of the Use Case Diagram Validator
 */
export const useCaseDiagramValidator = new UseCaseDiagramValidator();
