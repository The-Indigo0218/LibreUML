import type { BaseValidator } from './base-validator.types';
import type { ValidationResult } from '../registry/diagram-registry.types';
import type { DomainNode } from '../domain/models/nodes';
import type { DomainEdge } from '../domain/models/edges';
import type {
  ClassNode,
  InterfaceNode,
  AbstractClassNode,
  EnumNode,
} from '../domain/models/nodes/class-diagram.types';
import type {
  ClassDiagramEdgeType,
  AssociationEdge,
  AggregationEdge,
  CompositionEdge,
} from '../domain/models/edges/class-diagram.types';

/**
 * Class Diagram Validator
 * 
 * Implements UML 2.5 and Java semantic validation rules for Class Diagrams.
 * 
 * Key Rules:
 * - Classes can inherit from Classes or Abstract Classes
 * - Interfaces can only inherit from other Interfaces
 * - Enums cannot inherit from anything
 * - Classes, Abstract Classes, and Enums can implement Interfaces
 * - Interfaces cannot implement anything (they extend)
 * - All names must be valid Java identifiers
 */
export class ClassDiagramValidator implements BaseValidator {
  /**
   * Validates a connection between two nodes
   */
  validateConnection(
    sourceNode: DomainNode,
    targetNode: DomainNode,
    edgeType: string
  ): ValidationResult {
    // Type guard: ensure we're working with Class Diagram nodes
    if (!this.isClassDiagramNode(sourceNode) || !this.isClassDiagramNode(targetNode)) {
      return {
        isValid: false,
        errors: ['Invalid node types for Class Diagram'],
      };
    }

    // Validate based on edge type
    switch (edgeType as ClassDiagramEdgeType) {
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
   * Validates a node's domain data
   */
  validateNode(node: DomainNode): ValidationResult {
    if (!this.isClassDiagramNode(node)) {
      return {
        isValid: false,
        errors: ['Invalid node type for Class Diagram'],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate name (common to all types)
    if (!node.name || node.name.trim() === '') {
      errors.push(`${node.type} name cannot be empty`);
    } else {
      // Check for spaces
      if (node.name.includes(' ')) {
        errors.push(`${node.type} name cannot contain spaces`);
      }

      // Check for valid Java identifier
      if (!this.isValidJavaIdentifier(node.name)) {
        errors.push(`${node.type} name must be a valid Java identifier`);
      }
    }

    // Type-specific validation
    switch (node.type) {
      case 'CLASS':
      case 'ABSTRACT_CLASS':
        this.validateClassNode(node as ClassNode | AbstractClassNode, errors, warnings);
        break;
      
      case 'INTERFACE':
        this.validateInterfaceNode(node as InterfaceNode, errors, warnings);
        break;
      
      case 'ENUM':
        this.validateEnumNode(node as EnumNode, errors, warnings);
        break;
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validates an edge's domain data
   */
  validateEdge(
    edge: DomainEdge,
    _sourceNode: DomainNode,
    _targetNode: DomainNode
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate multiplicity for structural relationships
    if (
      edge.type === 'ASSOCIATION' ||
      edge.type === 'AGGREGATION' ||
      edge.type === 'COMPOSITION'
    ) {
      const structuralEdge = edge as AssociationEdge | AggregationEdge | CompositionEdge;

      if (structuralEdge.sourceMultiplicity) {
        if (!this.isValidMultiplicity(structuralEdge.sourceMultiplicity)) {
          warnings.push(
            `Invalid source multiplicity format: "${structuralEdge.sourceMultiplicity}". ` +
            `Expected formats: 1, *, 0..1, 1..*, 0..*, n, 1..n`
          );
        }
      }

      if (structuralEdge.targetMultiplicity) {
        if (!this.isValidMultiplicity(structuralEdge.targetMultiplicity)) {
          warnings.push(
            `Invalid target multiplicity format: "${structuralEdge.targetMultiplicity}". ` +
            `Expected formats: 1, *, 0..1, 1..*, 0..*, n, 1..n`
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Type guard for Class Diagram nodes
   */
  private isClassDiagramNode(
    node: DomainNode
  ): node is ClassNode | InterfaceNode | AbstractClassNode | EnumNode {
    return (
      node.type === 'CLASS' ||
      node.type === 'INTERFACE' ||
      node.type === 'ABSTRACT_CLASS' ||
      node.type === 'ENUM'
    );
  }

  /**
   * Validates inheritance relationships
   */
  private validateInheritance(
    sourceNode: ClassNode | InterfaceNode | AbstractClassNode | EnumNode,
    targetNode: ClassNode | InterfaceNode | AbstractClassNode | EnumNode
  ): ValidationResult {
    // Rule: Enums cannot inherit from anything
    if (sourceNode.type === 'ENUM') {
      return {
        isValid: false,
        errors: ['Enums cannot inherit from other types'],
      };
    }

    // Rule: Cannot inherit from Enum
    if (targetNode.type === 'ENUM') {
      return {
        isValid: false,
        errors: ['Cannot inherit from an Enum'],
      };
    }

    // Rule: Interfaces can only inherit from other Interfaces
    if (sourceNode.type === 'INTERFACE') {
      if (targetNode.type !== 'INTERFACE') {
        return {
          isValid: false,
          errors: ['Interfaces can only inherit from other Interfaces'],
        };
      }
      return { isValid: true };
    }

    // Rule: Classes can inherit from Classes or Abstract Classes
    if (sourceNode.type === 'CLASS' || sourceNode.type === 'ABSTRACT_CLASS') {
      if (targetNode.type === 'CLASS' || targetNode.type === 'ABSTRACT_CLASS') {
        return { isValid: true };
      }
      return {
        isValid: false,
        errors: [`${sourceNode.type} can only inherit from CLASS or ABSTRACT_CLASS`],
      };
    }

    return { isValid: true };
  }

  /**
   * Validates implementation relationships
   */
  private validateImplementation(
    sourceNode: ClassNode | InterfaceNode | AbstractClassNode | EnumNode,
    targetNode: ClassNode | InterfaceNode | AbstractClassNode | EnumNode
  ): ValidationResult {
    // Rule: Can only implement Interfaces
    if (targetNode.type !== 'INTERFACE') {
      return {
        isValid: false,
        errors: ['Can only implement Interfaces'],
      };
    }

    // Rule: Interfaces cannot implement (they extend)
    if (sourceNode.type === 'INTERFACE') {
      return {
        isValid: false,
        errors: ['Interfaces cannot implement interfaces (use inheritance instead)'],
      };
    }

    // Classes, Abstract Classes, and Enums can implement Interfaces
    return { isValid: true };
  }

  /**
   * Validates structural relationships (Association, Aggregation, Composition, Dependency)
   */
  private validateStructuralRelationship(
    _sourceNode: ClassNode | InterfaceNode | AbstractClassNode | EnumNode,
    _targetNode: ClassNode | InterfaceNode | AbstractClassNode | EnumNode,
    _edgeType: string
  ): ValidationResult {
    // Structural relationships are generally allowed between any class diagram nodes
    return { isValid: true };
  }

  /**
   * Validates a Class or Abstract Class node
   */
  private validateClassNode(
    node: ClassNode | AbstractClassNode,
    errors: string[],
    _warnings: string[]
  ): void {
    // Validate attributes
    node.attributes.forEach((attr, index) => {
      if (!attr.name || attr.name.trim() === '') {
        errors.push(`Attribute at index ${index} has no name`);
      }
      if (!attr.type || attr.type.trim() === '') {
        errors.push(`Attribute "${attr.name || index}" has no type`);
      }
    });

    // Validate methods
    node.methods.forEach((method, index) => {
      if (!method.name || method.name.trim() === '') {
        errors.push(`Method at index ${index} has no name`);
      }
      
      // Constructors don't need return type
      const isConstructor = method.name === node.name;
      if (!isConstructor && (!method.returnType || method.returnType.trim() === '')) {
        errors.push(`Method "${method.name || index}" has no return type`);
      }

      // Validate parameters
      method.parameters?.forEach((param, paramIndex) => {
        if (!param.name || param.name.trim() === '') {
          errors.push(`Parameter at index ${paramIndex} in method "${method.name}" has no name`);
        }
        if (!param.type || param.type.trim() === '') {
          errors.push(`Parameter "${param.name || paramIndex}" in method "${method.name}" has no type`);
        }
      });
    });
  }

  /**
   * Validates an Interface node
   */
  private validateInterfaceNode(
    _node: InterfaceNode,
    _errors: string[],
    _warnings: string[]
  ): void {
    // Interfaces in our model don't have attributes
    // Methods are validated at the type level
    // Additional validation can be added here if needed
  }

  /**
   * Validates an Enum node
   */
  private validateEnumNode(
    node: EnumNode,
    _errors: string[],
    warnings: string[]
  ): void {
    // Warn if enum has no literals
    if (!node.literals || node.literals.length === 0) {
      warnings.push('Enum has no literals defined');
    }

    // Validate literals
    node.literals?.forEach((literal, index) => {
      if (!literal.name || literal.name.trim() === '') {
        warnings.push(`Enum literal at index ${index} has no name`);
      }
    });
  }

  /**
   * Checks if a string is a valid Java identifier
   */
  private isValidJavaIdentifier(name: string): boolean {
    // Java identifier rules:
    // - Must start with letter, underscore, or dollar sign
    // - Can contain letters, digits, underscores, or dollar signs
    // - Cannot be a Java keyword (simplified check)
    const javaIdentifierRegex = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
    return javaIdentifierRegex.test(name);
  }

  /**
   * Validates multiplicity format
   */
  private isValidMultiplicity(multiplicity: string): boolean {
    // Valid formats: 1, *, 0..1, 1..*, 0..*, n, 1..n, etc.
    const multiplicityRegex = /^(\d+|\*|n)(\.\.((\d+|\*|n)))?$/;
    return multiplicityRegex.test(multiplicity);
  }
}

/**
 * Singleton instance for use across the application
 */
export const classDiagramValidator = new ClassDiagramValidator();
