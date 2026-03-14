import { describe, it, expect } from 'vitest';
import { ClassDiagramValidator } from '../class-diagram.validator';
import type { ClassNode, InterfaceNode, EnumNode, AbstractClassNode } from '../../domain/models/nodes/class-diagram.types';
import type { AssociationEdge } from '../../domain/models/edges/class-diagram.types';

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
      expect(result.errors).toContain('UML 2.5: Cannot inherit from an Enumeration');
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
      expect(result.errors).toContain('UML 2.5: Enumerations cannot have generalizations');
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
      expect(result.errors).toContain('UML 2.5: Interfaces can only generalize other Interfaces');
    });

    it('should NOT allow self-inheritance', () => {
      const node: ClassNode = {
        id: 'class-1',
        type: 'CLASS',
        name: 'MyClass',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(node, node, 'INHERITANCE');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('UML 2.5: Self-inheritance is not allowed');
    });

    it('should NOT allow circular inheritance (direct cycle)', () => {
      const classA: ClassNode = {
        id: 'class-a',
        type: 'CLASS',
        name: 'ClassA',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const classB: ClassNode = {
        id: 'class-b',
        type: 'CLASS',
        name: 'ClassB',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const existingEdges = [
        {
          id: 'edge-1',
          type: 'INHERITANCE' as const,
          sourceNodeId: 'class-a',
          targetNodeId: 'class-b',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      ];

      const allNodes = {
        'class-a': classA,
        'class-b': classB,
      };

      const result = validator.validateConnection(classB, classA, 'INHERITANCE', existingEdges, allNodes);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('UML 2.5: Circular inheritance is not allowed');
    });

    it('should NOT allow circular inheritance (indirect cycle)', () => {
      const classA: ClassNode = {
        id: 'class-a',
        type: 'CLASS',
        name: 'ClassA',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const classB: ClassNode = {
        id: 'class-b',
        type: 'CLASS',
        name: 'ClassB',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const classC: ClassNode = {
        id: 'class-c',
        type: 'CLASS',
        name: 'ClassC',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const existingEdges = [
        {
          id: 'edge-1',
          type: 'INHERITANCE' as const,
          sourceNodeId: 'class-a',
          targetNodeId: 'class-b',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'edge-2',
          type: 'INHERITANCE' as const,
          sourceNodeId: 'class-b',
          targetNodeId: 'class-c',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      ];

      const allNodes = {
        'class-a': classA,
        'class-b': classB,
        'class-c': classC,
      };

      const result = validator.validateConnection(classC, classA, 'INHERITANCE', existingEdges, allNodes);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('UML 2.5: Circular inheritance is not allowed');
    });

    it('should allow multiple inheritance (UML 2.5 supports it)', () => {
      const child: ClassNode = {
        id: 'child',
        type: 'CLASS',
        name: 'Child',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const parent1: ClassNode = {
        id: 'parent-1',
        type: 'CLASS',
        name: 'Parent1',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const parent2: ClassNode = {
        id: 'parent-2',
        type: 'CLASS',
        name: 'Parent2',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const existingEdges = [
        {
          id: 'edge-1',
          type: 'INHERITANCE' as const,
          sourceNodeId: 'child',
          targetNodeId: 'parent-1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      ];

      const allNodes = {
        'child': child,
        'parent-1': parent1,
        'parent-2': parent2,
      };

      const result = validator.validateConnection(child, parent2, 'INHERITANCE', existingEdges, allNodes);
      expect(result.isValid).toBe(true);
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
      expect(result.errors?.[0]).toContain('UML 2.5: Interfaces cannot realize other Interfaces');
    });

    it('should NOT allow self-implementation', () => {
      const node: ClassNode = {
        id: 'class-1',
        type: 'CLASS',
        name: 'MyClass',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const interfaceNode: InterfaceNode = {
        id: 'interface-1',
        type: 'INTERFACE',
        name: 'MyInterface',
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(interfaceNode, interfaceNode, 'IMPLEMENTATION');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('UML 2.5: Self-realization is not allowed');
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
      expect(result.errors).toContain('CLASS name cannot be empty');
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
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('CLASS name contains spaces (not recommended for code generation)');
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
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('CLASS name should be a valid identifier for code generation');
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
