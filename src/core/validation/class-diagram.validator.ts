import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';
import type { DiagramValidator, ValidationResult } from '../registry/diagram-registry.types';
import type {
  ClassNode,
  InterfaceNode,
  AbstractClassNode,
  EnumNode,
  NoteNode,
} from '../domain/models/nodes/class-diagram.types';
import type { ClassDiagramEdge } from '../domain/models/edges/class-diagram.types';

/**
 * Class Diagram Validator
 * Implements UML 2.5 and Java semantic validation rules for Class Diagrams.
 */
export class ClassDiagramValidator implements DiagramValidator {
  /**
   * Validates if a connection between two nodes is allowed.
   * 
   * Rules:
   * - INHERITANCE: Class → Class/Abstract, Interface → Interface (same type)
   * - IMPLEMENTATION: Class/Abstract/Enum → Interface
   * - ASSOCIATION/AGGREGATION/COMPOSITION: Any non-note → Any non-note
   * - DEPENDENCY: Any non-note → Any non-note
   * - NOTE_LINK: Note → Any or Any → Note
   */
  validateConnection(
    sourceNode: DomainNode,
    targetNode: DomainNode,
    edgeType: string
  ): ValidationResult {
    // Notes can connect to anything
    if (sourceNode.type === 'NOTE' || targetNode.type === 'NOTE') {
      if (edgeType === 'NOTE_LINK') {
        return { isValid: true };
      }
      return {
        isValid: false,
        errors: ['Notes can only use NOTE_LINK connections'],
      };
    }

    // Validate based on edge type
    switch (edgeType) {
      case 'INHERITANCE':
        return this.validateInheritance(sourceNode, targetNode);
      
      case 'IMPLEMENTATION':
        return this.validateImplementation(sourceNode, targetNode);
      
      case 'ASSOCIATION':
      case 'AGGREGATION':
      case 'COMPOSITION':
      case 'DEPENDENCY':
        return this.validateStructuralRelationship(sourceNode, targetNode, edgeType);
      
      default:
        return {
          isValid: false,
          errors: [`Unknown edge type: ${edgeType}`],
        };
    }
  }

  /**
   * Validates inheritance relationships.
   * Rules:
   * - Class can inherit from Class or Abstract Class
   * - Interface can inherit from Interface
   * - Abstract Class can inherit from Class or Abstract Class
   * - Enum CANNOT inherit from anything
   * - Cannot inherit from Enum
   */
  private validateInheritance(
    sourceNode: DomainNode,
    targetNode: DomainNode
  ): ValidationResult {
    const sourceType = sourceNode.type;
    const targetType = targetNode.type;

    // Enums cannot inherit
    if (sourceType === 'ENUM') {
      return {
        isValid: false,
        errors: ['Enums cannot inherit from other types'],
      };
    }

    // Cannot inherit from Enum
    if (targetType === 'ENUM') {
      return {
        isValid: false,
        errors: ['Cannot inherit from an Enum'],
      };
    }

    // Interface can only inherit from Interface
    if (sourceType === 'INTERFACE') {
      if (targetType !== 'INTERFACE') {
        return {
          isValid: false,
          errors: ['Interfaces can only inherit from other Interfaces'],
        };
      }
      return { isValid: true };
    }

    // Class/Abstract can inherit from Class/Abstract
    if (
      (sourceType === 'CLASS' || sourceType === 'ABSTRACT_CLASS') &&
      (targetType === 'CLASS' || targetType === 'ABSTRACT_CLASS')
    ) {
      return { isValid: true };
    }

    return {
      isValid: false,
      errors: [
        `Invalid inheritance: ${sourceType} cannot inherit from ${targetType}`,
      ],
    };
  }

  /**
   * Validates implementation relationships.
   * Rules:
   * - Class, Abstract Class, or Enum can implement Interface
   * - Interface CANNOT implement anything
   * - Can only implement Interface (not Class/Abstract/Enum)
   */
  private validateImplementation(
    sourceNode: DomainNode,
    targetNode: DomainNode
  ): ValidationResult {
    const sourceType = sourceNode.type;
    const targetType = targetNode.type;

    // Only Class, Abstract Class, and Enum can implement
    if (
      sourceType !== 'CLASS' &&
      sourceType !== 'ABSTRACT_CLASS' &&
      sourceType !== 'ENUM'
    ) {
      return {
        isValid: false,
        errors: [`${sourceType} cannot implement interfaces`],
      };
    }

    // Can only implement Interface
    if (targetType !== 'INTERFACE') {
      return {
        isValid: false,
        errors: [`Can only implement Interfaces, not ${targetType}`],
      };
    }

    return { isValid: true };
  }

  /**
   * Validates structural relationships (Association, Aggregation, Composition, Dependency).
   * Rules:
   * - Any non-note class diagram element can have these relationships
   * - Notes are excluded (handled separately)
   */
  private validateStructuralRelationship(
    sourceNode: DomainNode,
    targetNode: DomainNode,
    edgeType: string
  ): ValidationResult {
    const validTypes = ['CLASS', 'INTERFACE', 'ABSTRACT_CLASS', 'ENUM'];
    
    if (!validTypes.includes(sourceNode.type)) {
      return {
        isValid: false,
        errors: [`${sourceNode.type} cannot be the source of ${edgeType}`],
      };
    }

    if (!validTypes.includes(targetNode.type)) {
      return {
        isValid: false,
        errors: [`${targetNode.type} cannot be the target of ${edgeType}`],
      };
    }

    return { isValid: true };
  }

  /**
   * Validates a node's domain data.
   * 
   * Rules:
   * - Name must not be empty
   * - Name must not contain spaces (Java identifier rules)
   * - Attributes must have valid names and types
   * - Methods must have valid names and return types
   */
  validateNode(node: DomainNode): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Type-specific validation
    switch (node.type) {
      case 'CLASS':
      case 'INTERFACE':
      case 'ABSTRACT_CLASS':
        this.validateClassLikeNode(
          node as ClassNode | InterfaceNode | AbstractClassNode,
          errors,
          warnings
        );
        break;
      
      case 'ENUM':
        this.validateEnumNode(node as EnumNode, errors, warnings);
        break;
      
      case 'NOTE':
        this.validateNoteNode(node as NoteNode, errors, warnings);
        break;
      
      default:
        errors.push(`Unknown node type: ${node.type}`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validates Class, Interface, or Abstract Class nodes.
   */
  private validateClassLikeNode(
    node: ClassNode | InterfaceNode | AbstractClassNode,
    errors: string[],
    warnings: string[]
  ): void {
    // Name validation
    if (!node.name || node.name.trim() === '') {
      errors.push('Class name cannot be empty');
    } else if (/\s/.test(node.name)) {
      errors.push('Class name cannot contain spaces');
    } else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(node.name)) {
      errors.push('Class name must be a valid Java identifier');
    }

    // Generics validation (if present)
    if (node.generics && node.generics.trim() !== '') {
      if (!node.generics.startsWith('<') || !node.generics.endsWith('>')) {
        warnings.push('Generics should be wrapped in angle brackets (e.g., <T>)');
      }
    }

    // Validate attributes (if present)
    if ('attributes' in node && node.attributes) {
      node.attributes.forEach((attr, index) => {
        if (!attr.name || attr.name.trim() === '') {
          errors.push(`Attribute at index ${index} has no name`);
        }
        if (!attr.type || attr.type.trim() === '') {
          errors.push(`Attribute "${attr.name}" has no type`);
        }
      });
    }

    // Validate methods
    if (node.methods) {
      node.methods.forEach((method, index) => {
        if (!method.name || method.name.trim() === '') {
          errors.push(`Method at index ${index} has no name`);
        }
        if (!method.isConstructor && (!method.returnType || method.returnType.trim() === '')) {
          errors.push(`Method "${method.name}" has no return type`);
        }
        
        // Validate parameters
        method.parameters.forEach((param, pIndex) => {
          if (!param.name || param.name.trim() === '') {
            errors.push(`Parameter ${pIndex} of method "${method.name}" has no name`);
          }
          if (!param.type || param.type.trim() === '') {
            errors.push(`Parameter "${param.name}" of method "${method.name}" has no type`);
          }
        });
      });
    }

    // Interface-specific validation
    if (node.type === 'INTERFACE') {
      if ('attributes' in node && node.attributes && node.attributes.length > 0) {
        warnings.push('Interfaces typically should not have attributes (only constants)');
      }
    }
  }

  /**
   * Validates Enum nodes.
   */
  private validateEnumNode(
    node: EnumNode,
    errors: string[],
    warnings: string[]
  ): void {
    // Name validation
    if (!node.name || node.name.trim() === '') {
      errors.push('Enum name cannot be empty');
    } else if (/\s/.test(node.name)) {
      errors.push('Enum name cannot contain spaces');
    }

    // Literals validation
    if (!node.literals || node.literals.length === 0) {
      warnings.push('Enum has no literals defined');
    } else {
      node.literals.forEach((literal, index) => {
        if (!literal.name || literal.name.trim() === '') {
          errors.push(`Enum literal at index ${index} has no name`);
        }
      });
    }
  }

  /**
   * Validates Note nodes.
   */
  private validateNoteNode(
    node: NoteNode,
    errors: string[],
    warnings: string[]
  ): void {
    if (!node.content || node.content.trim() === '') {
      warnings.push('Note has no content');
    }
  }

  /**
   * Validates an edge's domain data.
   * 
   * Rules:
   * - Source and target node IDs must exist
   * - Multiplicity format must be valid (if present)
   */
  validateEdge(
    edge: DomainEdge,
    sourceNode: DomainNode,
    targetNode: DomainNode
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate edge type is a Class Diagram edge
    const validEdgeTypes = [
      'ASSOCIATION',
      'INHERITANCE',
      'IMPLEMENTATION',
      'DEPENDENCY',
      'AGGREGATION',
      'COMPOSITION',
      'NOTE_LINK',
    ];

    if (!validEdgeTypes.includes(edge.type)) {
      errors.push(`Invalid edge type for Class Diagram: ${edge.type}`);
    }

    // Validate multiplicity format (if present)
    const classEdge = edge as ClassDiagramEdge;
    if ('sourceMultiplicity' in classEdge && classEdge.sourceMultiplicity) {
      if (!this.isValidMultiplicity(classEdge.sourceMultiplicity)) {
        warnings.push(`Invalid source multiplicity format: ${classEdge.sourceMultiplicity}`);
      }
    }
    if ('targetMultiplicity' in classEdge && classEdge.targetMultiplicity) {
      if (!this.isValidMultiplicity(classEdge.targetMultiplicity)) {
        warnings.push(`Invalid target multiplicity format: ${classEdge.targetMultiplicity}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validates multiplicity format.
   * Valid formats: "1", "0..1", "1..*", "*", "0..*", "n", "1..n"
   */
  private isValidMultiplicity(multiplicity: string): boolean {
    const validPatterns = [
      /^\d+$/,                    // "1", "2", etc.
      /^\d+\.\.\d+$/,             // "1..5"
      /^\d+\.\.\*$/,              // "1..*"
      /^0\.\.\*$/,                // "0..*"
      /^\*$/,                     // "*"
      /^[a-z]$/,                  // "n", "m"
      /^\d+\.\.[a-z]$/,           // "1..n"
    ];

    return validPatterns.some(pattern => pattern.test(multiplicity.trim()));
  }
}

/**
 * Singleton instance of the Class Diagram Validator
 */
export const classDiagramValidator = new ClassDiagramValidator();
