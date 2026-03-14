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

export class ClassDiagramValidator implements BaseValidator {
  validateConnection(
    sourceNode: DomainNode,
    targetNode: DomainNode,
    edgeType: string,
    existingEdges: DomainEdge[] = [],
    allNodes: Record<string, DomainNode> = {}
  ): ValidationResult {
    if (!this.isClassDiagramNode(sourceNode) || !this.isClassDiagramNode(targetNode)) {
      return {
        isValid: false,
        errors: ['Invalid node types for Class Diagram'],
      };
    }

    switch (edgeType as ClassDiagramEdgeType) {
      case 'INHERITANCE':
        return this.validateInheritance(sourceNode, targetNode, existingEdges, allNodes);
      
      case 'IMPLEMENTATION':
        return this.validateImplementation(sourceNode, targetNode);
      
      case 'ASSOCIATION':
      case 'AGGREGATION':
      case 'COMPOSITION':
      case 'DEPENDENCY':
        return this.validateStructuralRelationship(sourceNode, targetNode);
      
      default:
        return {
          isValid: false,
          errors: [`Unknown edge type: ${edgeType}`],
        };
    }
  }

  validateNode(node: DomainNode): ValidationResult {
    if (!this.isClassDiagramNode(node)) {
      return {
        isValid: false,
        errors: ['Invalid node type for Class Diagram'],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!node.name || node.name.trim() === '') {
      errors.push(`${node.type} name cannot be empty`);
    } else {
      if (node.name.includes(' ')) {
        warnings.push(`${node.type} name contains spaces (not recommended for code generation)`);
      }

      if (!this.isValidIdentifier(node.name)) {
        warnings.push(`${node.type} name should be a valid identifier for code generation`);
      }
    }

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

  validateEdge(
    edge: DomainEdge,
    _sourceNode: DomainNode,
    _targetNode: DomainNode
  ): ValidationResult {
    const warnings: string[] = [];

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
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

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

  private validateInheritance(
    sourceNode: ClassNode | InterfaceNode | AbstractClassNode | EnumNode,
    targetNode: ClassNode | InterfaceNode | AbstractClassNode | EnumNode,
    existingEdges: DomainEdge[],
    allNodes: Record<string, DomainNode>
  ): ValidationResult {
    if (sourceNode.id === targetNode.id) {
      return {
        isValid: false,
        errors: ['UML 2.5: Self-inheritance is not allowed'],
      };
    }

    if (this.wouldCreateCycle(sourceNode.id, targetNode.id, existingEdges, allNodes)) {
      return {
        isValid: false,
        errors: ['UML 2.5: Circular inheritance is not allowed'],
      };
    }

    if (sourceNode.type === 'ENUM') {
      return {
        isValid: false,
        errors: ['UML 2.5: Enumerations cannot have generalizations'],
      };
    }

    if (targetNode.type === 'ENUM') {
      return {
        isValid: false,
        errors: ['UML 2.5: Cannot inherit from an Enumeration'],
      };
    }

    if (sourceNode.type === 'INTERFACE' && targetNode.type !== 'INTERFACE') {
      return {
        isValid: false,
        errors: ['UML 2.5: Interfaces can only generalize other Interfaces'],
      };
    }

    if ((sourceNode.type === 'CLASS' || sourceNode.type === 'ABSTRACT_CLASS') &&
        targetNode.type === 'INTERFACE') {
      return {
        isValid: false,
        errors: ['UML 2.5: Classes cannot inherit from Interfaces (use realization instead)'],
      };
    }

    return { isValid: true };
  }

  private validateImplementation(
    sourceNode: ClassNode | InterfaceNode | AbstractClassNode | EnumNode,
    targetNode: ClassNode | InterfaceNode | AbstractClassNode | EnumNode
  ): ValidationResult {
    if (sourceNode.id === targetNode.id) {
      return {
        isValid: false,
        errors: ['UML 2.5: Self-realization is not allowed'],
      };
    }

    if (targetNode.type !== 'INTERFACE') {
      return {
        isValid: false,
        errors: ['UML 2.5: Can only realize (implement) Interfaces'],
      };
    }

    if (sourceNode.type === 'INTERFACE') {
      return {
        isValid: false,
        errors: ['UML 2.5: Interfaces cannot realize other Interfaces (use generalization instead)'],
      };
    }

    return { isValid: true };
  }

  private validateStructuralRelationship(
    sourceNode: ClassNode | InterfaceNode | AbstractClassNode | EnumNode,
    targetNode: ClassNode | InterfaceNode | AbstractClassNode | EnumNode
  ): ValidationResult {
    return { isValid: true };
  }

  private wouldCreateCycle(
    sourceId: string,
    targetId: string,
    existingEdges: DomainEdge[],
    _allNodes: Record<string, DomainNode>
  ): boolean {
    const inheritanceEdges = existingEdges.filter(
      edge => edge.type === 'INHERITANCE'
    );

    const simulatedEdges = [
      ...inheritanceEdges,
      {
        id: 'temp',
        type: 'INHERITANCE' as const,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
    ];

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const children = simulatedEdges
        .filter(edge => edge.targetNodeId === nodeId)
        .map(edge => edge.sourceNodeId);

      for (const childId of children) {
        if (hasCycle(childId)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    const allNodeIds = new Set([
      sourceId,
      targetId,
      ...simulatedEdges.map(e => e.sourceNodeId),
      ...simulatedEdges.map(e => e.targetNodeId),
    ]);

    for (const nodeId of allNodeIds) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId)) {
          return true;
        }
      }
    }

    return false;
  }

  private validateClassNode(
    node: ClassNode | AbstractClassNode,
    errors: string[],
    _warnings: string[]
  ): void {
    node.attributes.forEach((attr, index) => {
      if (!attr.name || attr.name.trim() === '') {
        errors.push(`Attribute at index ${index} has no name`);
      }
      if (!attr.type || attr.type.trim() === '') {
        errors.push(`Attribute "${attr.name || index}" has no type`);
      }
    });

    node.methods.forEach((method, index) => {
      if (!method.name || method.name.trim() === '') {
        errors.push(`Method at index ${index} has no name`);
      }
      
      const isConstructor = method.name === node.name;
      if (!isConstructor && (!method.returnType || method.returnType.trim() === '')) {
        errors.push(`Method "${method.name || index}" has no return type`);
      }

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

  private validateInterfaceNode(
    _node: InterfaceNode,
    _errors: string[],
    _warnings: string[]
  ): void {
  }

  private validateEnumNode(
    node: EnumNode,
    _errors: string[],
    warnings: string[]
  ): void {
    if (!node.literals || node.literals.length === 0) {
      warnings.push('Enum has no literals defined');
    }

    node.literals?.forEach((literal, index) => {
      if (!literal.name || literal.name.trim() === '') {
        warnings.push(`Enum literal at index ${index} has no name`);
      }
    });
  }

  private isValidIdentifier(name: string): boolean {
    const identifierRegex = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
    return identifierRegex.test(name);
  }

  private isValidMultiplicity(multiplicity: string): boolean {
    const multiplicityRegex = /^(\d+|\*|n)(\.\.((\d+|\*|n)))?$/;
    return multiplicityRegex.test(multiplicity);
  }
}

export const classDiagramValidator = new ClassDiagramValidator();
