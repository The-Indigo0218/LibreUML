import { describe, it, expect } from 'vitest';
import { ClassDiagramValidator } from '../class-diagram.validator';
import type { ClassNode, InterfaceNode, EnumNode, AbstractClassNode } from '../../domain/models/nodes/class-diagram.types';
import type { InheritanceEdge, ImplementationEdge, AssociationEdge } from '../../domain/models/edges/class-diagram.types';

describe('ClassDiagramValidator', () => {
  const validator = new ClassDiagramValidator();

  describe('validateConnection - Inheritance', () => {
    it('should allow Class to inherit from Class', () => {
      const sourceNode: ClassNode = {
        id: 'class-1',
        type: 'CLASS',
        name: 'Child',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: ClassNode = {
        id: 'class-2',
        type: 'CLASS',
        name: 'Parent',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'INHERITANCE');
      expect(result.isValid).toBe(true);
    });

    it('should allow Class to inherit from Abstract Class', () => {
      const sourceNode: ClassNode = {
        id: 'class-1',
        type: 'CLASS',
        name: 'ConcreteClass',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: AbstractClassNode = {
        id: 'abstract-1',
        type: 'ABSTRACT_CLASS',
        name: 'AbstractBase',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'INHERITANCE');
      expect(result.isValid).toBe(true);
    });

    it('should NOT allow Class to inherit from Enum', () => {
      const sourceNode: ClassNode = {
        id: 'class-1',
        type: 'CLASS',
        name: 'MyClass',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: EnumNode = {
        id: 'enum-1',
        type: 'ENUM',
        name: 'MyEnum',
        literals: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'INHERITANCE');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot inherit from an Enum');
    });

    it('should NOT allow Enum to inherit from anything', () => {
      const sourceNode: EnumNode = {
        id: 'enum-1',
        type: 'ENUM',
        name: 'MyEnum',
        literals: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: ClassNode = {
        id: 'class-1',
        type: 'CLASS',
        name: 'MyClass',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'INHERITANCE');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Enums cannot inherit from other types');
    });

    it('should allow Interface to inherit from Interface', () => {
      const sourceNode: InterfaceNode = {
        id: 'interface-1',
        type: 'INTERFACE',
        name: 'ChildInterface',
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: InterfaceNode = {
        id: 'interface-2',
        type: 'INTERFACE',
        name: 'ParentInterface',
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'INHERITANCE');
      expect(result.isValid).toBe(true);
    });

    it('should NOT allow Interface to inherit from Class', () => {
      const sourceNode: InterfaceNode = {
        id: 'interface-1',
        type: 'INTERFACE',
        name: 'MyInterface',
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: ClassNode = {
        id: 'class-1',
        type: 'CLASS',
        name: 'MyClass',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'INHERITANCE');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Interfaces can only inherit from other Interfaces');
    });
  });

  describe('validateConnection - Implementation', () => {
    it('should allow Class to implement Interface', () => {
      const sourceNode: ClassNode = {
        id: 'class-1',
        type: 'CLASS',
        name: 'MyClass',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: InterfaceNode = {
        id: 'interface-1',
        type: 'INTERFACE',
        name: 'MyInterface',
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'IMPLEMENTATION');
      expect(result.isValid).toBe(true);
    });

    it('should allow Enum to implement Interface', () => {
      const sourceNode: EnumNode = {
        id: 'enum-1',
        type: 'ENUM',
        name: 'MyEnum',
        literals: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: InterfaceNode = {
        id: 'interface-1',
        type: 'INTERFACE',
        name: 'MyInterface',
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'IMPLEMENTATION');
      expect(result.isValid).toBe(true);
    });

    it('should NOT allow Interface to implement anything', () => {
      const sourceNode: InterfaceNode = {
        id: 'interface-1',
        type: 'INTERFACE',
        name: 'MyInterface',
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: InterfaceNode = {
        id: 'interface-2',
        type: 'INTERFACE',
        name: 'OtherInterface',
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'IMPLEMENTATION');
      expect(result.isValid).toBe(false);
      expect(result.errors?.[0]).toContain('cannot implement interfaces');
    });
  });

  describe('validateNode', () => {
    it('should validate a valid Class node', () => {
      const node: ClassNode = {
        id: 'class-1',
        type: 'CLASS',
        name: 'ValidClass',
        attributes: [
          {
            id: 'attr-1',
            name: 'name',
            type: 'String',
            visibility: '+',
            isArray: false,
          },
        ],
        methods: [
          {
            id: 'method-1',
            name: 'getName',
            returnType: 'String',
            visibility: '+',
            parameters: [],
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateNode(node);
      expect(result.isValid).toBe(true);
    });

    it('should reject Class with empty name', () => {
      const node: ClassNode = {
        id: 'class-1',
        type: 'CLASS',
        name: '',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateNode(node);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Class name cannot be empty');
    });

    it('should reject Class with spaces in name', () => {
      const node: ClassNode = {
        id: 'class-1',
        type: 'CLASS',
        name: 'Invalid Class',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateNode(node);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Class name cannot contain spaces');
    });

    it('should reject Class with invalid Java identifier', () => {
      const node: ClassNode = {
        id: 'class-1',
        type: 'CLASS',
        name: '123Invalid',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateNode(node);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Class name must be a valid Java identifier');
    });

    it('should validate Enum with literals', () => {
      const node: EnumNode = {
        id: 'enum-1',
        type: 'ENUM',
        name: 'Status',
        literals: [
          { id: 'lit-1', name: 'ACTIVE' },
          { id: 'lit-2', name: 'INACTIVE' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateNode(node);
      expect(result.isValid).toBe(true);
    });

    it('should warn about Enum with no literals', () => {
      const node: EnumNode = {
        id: 'enum-1',
        type: 'ENUM',
        name: 'EmptyEnum',
        literals: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateNode(node);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Enum has no literals defined');
    });
  });

  describe('validateEdge', () => {
    const sourceNode: ClassNode = {
      id: 'class-1',
      type: 'CLASS',
      name: 'Source',
      attributes: [],
      methods: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const targetNode: ClassNode = {
      id: 'class-2',
      type: 'CLASS',
      name: 'Target',
      attributes: [],
      methods: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('should validate edge with valid multiplicity', () => {
      const edge: AssociationEdge = {
        id: 'edge-1',
        type: 'ASSOCIATION',
        sourceNodeId: 'class-1',
        targetNodeId: 'class-2',
        sourceMultiplicity: '1',
        targetMultiplicity: '*',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateEdge(edge, sourceNode, targetNode);
      expect(result.isValid).toBe(true);
    });

    it('should warn about invalid multiplicity format', () => {
      const edge: AssociationEdge = {
        id: 'edge-1',
        type: 'ASSOCIATION',
        sourceNodeId: 'class-1',
        targetNodeId: 'class-2',
        sourceMultiplicity: 'invalid',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateEdge(edge, sourceNode, targetNode);
      expect(result.isValid).toBe(true);
      expect(result.warnings?.[0]).toContain('Invalid source multiplicity format');
    });
  });
});
