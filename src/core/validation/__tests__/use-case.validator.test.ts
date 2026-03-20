import { describe, it, expect } from 'vitest';
import { UseCaseDiagramValidator } from '../use-case.validator';
import type { ActorNode, UseCaseNode, SystemBoundaryNode } from '../../domain/models/nodes/use-case.types';
import type { IncludeEdge, ExtendEdge } from '../../domain/models/edges/use-case.types';

describe('UseCaseDiagramValidator', () => {
  const validator = new UseCaseDiagramValidator();

  describe('validateConnection - Association', () => {
    it('should allow Actor to associate with Use Case', () => {
      const sourceNode: ActorNode = {
        id: 'actor-1',
        type: 'ACTOR',
        name: 'User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: UseCaseNode = {
        id: 'usecase-1',
        type: 'USE_CASE',
        name: 'Login',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'ASSOCIATION');
      expect(result.isValid).toBe(true);
    });

    it('should allow Use Case to associate with Actor', () => {
      const sourceNode: UseCaseNode = {
        id: 'usecase-1',
        type: 'USE_CASE',
        name: 'Login',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: ActorNode = {
        id: 'actor-1',
        type: 'ACTOR',
        name: 'User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'ASSOCIATION');
      expect(result.isValid).toBe(true);
    });

    it('should NOT allow Actor to associate with Actor', () => {
      const sourceNode: ActorNode = {
        id: 'actor-1',
        type: 'ACTOR',
        name: 'User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: ActorNode = {
        id: 'actor-2',
        type: 'ACTOR',
        name: 'Admin',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'ASSOCIATION');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Use Generalization for Actor-to-Actor relationships');
    });

    it('should NOT allow Use Case to associate with Use Case', () => {
      const sourceNode: UseCaseNode = {
        id: 'usecase-1',
        type: 'USE_CASE',
        name: 'Login',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: UseCaseNode = {
        id: 'usecase-2',
        type: 'USE_CASE',
        name: 'Logout',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'ASSOCIATION');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Use Include or Extend for Use Case-to-Use Case relationships');
    });
  });

  describe('validateConnection - Include', () => {
    it('should allow Use Case to include Use Case', () => {
      const sourceNode: UseCaseNode = {
        id: 'usecase-1',
        type: 'USE_CASE',
        name: 'Login',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: UseCaseNode = {
        id: 'usecase-2',
        type: 'USE_CASE',
        name: 'ValidateCredentials',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'INCLUDE');
      expect(result.isValid).toBe(true);
    });

    it('should NOT allow Actor to include Use Case', () => {
      const sourceNode: ActorNode = {
        id: 'actor-1',
        type: 'ACTOR',
        name: 'User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: UseCaseNode = {
        id: 'usecase-1',
        type: 'USE_CASE',
        name: 'Login',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'INCLUDE');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Include relationship source must be a Use Case');
    });
  });

  describe('validateConnection - Extend', () => {
    it('should allow Use Case to extend Use Case', () => {
      const sourceNode: UseCaseNode = {
        id: 'usecase-1',
        type: 'USE_CASE',
        name: 'LoginWithBiometrics',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: UseCaseNode = {
        id: 'usecase-2',
        type: 'USE_CASE',
        name: 'Login',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'EXTEND');
      expect(result.isValid).toBe(true);
    });

    it('should NOT allow Actor to extend Use Case', () => {
      const sourceNode: ActorNode = {
        id: 'actor-1',
        type: 'ACTOR',
        name: 'User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: UseCaseNode = {
        id: 'usecase-1',
        type: 'USE_CASE',
        name: 'Login',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'EXTEND');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Extend relationship source must be a Use Case');
    });
  });

  describe('validateConnection - Generalization', () => {
    it('should allow Actor to generalize Actor', () => {
      const sourceNode: ActorNode = {
        id: 'actor-1',
        type: 'ACTOR',
        name: 'Admin',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: ActorNode = {
        id: 'actor-2',
        type: 'ACTOR',
        name: 'User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'GENERALIZATION');
      expect(result.isValid).toBe(true);
    });

    it('should allow Use Case to generalize Use Case', () => {
      const sourceNode: UseCaseNode = {
        id: 'usecase-1',
        type: 'USE_CASE',
        name: 'SpecialLogin',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: UseCaseNode = {
        id: 'usecase-2',
        type: 'USE_CASE',
        name: 'Login',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'GENERALIZATION');
      expect(result.isValid).toBe(true);
    });

    it('should NOT allow Actor to generalize Use Case', () => {
      const sourceNode: ActorNode = {
        id: 'actor-1',
        type: 'ACTOR',
        name: 'User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: UseCaseNode = {
        id: 'usecase-1',
        type: 'USE_CASE',
        name: 'Login',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'GENERALIZATION');
      expect(result.isValid).toBe(false);
      expect(result.errors?.[0]).toContain('Generalization must be between same types');
    });
  });

  describe('validateConnection - System Boundary', () => {
    it('should NOT allow System Boundary as source', () => {
      const sourceNode: SystemBoundaryNode = {
        id: 'boundary-1',
        type: 'SYSTEM_BOUNDARY',
        name: 'System',
        containedUseCaseIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: UseCaseNode = {
        id: 'usecase-1',
        type: 'USE_CASE',
        name: 'Login',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'ASSOCIATION');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('System Boundary cannot be the source of a connection');
    });

    it('should NOT allow System Boundary as target', () => {
      const sourceNode: ActorNode = {
        id: 'actor-1',
        type: 'ACTOR',
        name: 'User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const targetNode: SystemBoundaryNode = {
        id: 'boundary-1',
        type: 'SYSTEM_BOUNDARY',
        name: 'System',
        containedUseCaseIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateConnection(sourceNode, targetNode, 'ASSOCIATION');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('System Boundary cannot be the target of a connection');
    });
  });

  describe('validateNode', () => {
    it('should validate a valid Actor node', () => {
      const node: ActorNode = {
        id: 'actor-1',
        type: 'ACTOR',
        name: 'User',
        documentation: 'A system user',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateNode(node);
      expect(result.isValid).toBe(true);
    });

    it('should reject Actor with empty name', () => {
      const node: ActorNode = {
        id: 'actor-1',
        type: 'ACTOR',
        name: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateNode(node);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Actor name cannot be empty');
    });

    it('should validate a valid Use Case node', () => {
      const node: UseCaseNode = {
        id: 'usecase-1',
        type: 'USE_CASE',
        name: 'Login',
        description: 'User logs into the system',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateNode(node);
      expect(result.isValid).toBe(true);
    });

    it('should reject Use Case with empty name', () => {
      const node: UseCaseNode = {
        id: 'usecase-1',
        type: 'USE_CASE',
        name: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateNode(node);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Use Case name cannot be empty');
    });

    it('should warn about Use Case with lowercase first letter', () => {
      const node: UseCaseNode = {
        id: 'usecase-1',
        type: 'USE_CASE',
        name: 'login',
        description: 'User logs in',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateNode(node);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Use Case names typically start with a capital letter');
    });

    it('should validate System Boundary node', () => {
      const node: SystemBoundaryNode = {
        id: 'boundary-1',
        type: 'SYSTEM_BOUNDARY',
        name: 'Banking System',
        containedUseCaseIds: ['usecase-1', 'usecase-2'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateNode(node);
      expect(result.isValid).toBe(true);
    });

    it('should warn about empty System Boundary', () => {
      const node: SystemBoundaryNode = {
        id: 'boundary-1',
        type: 'SYSTEM_BOUNDARY',
        name: 'Empty System',
        containedUseCaseIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateNode(node);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('System Boundary contains no Use Cases');
    });
  });

  describe('validateEdge', () => {
    const sourceNode: UseCaseNode = {
      id: 'usecase-1',
      type: 'USE_CASE',
      name: 'Login',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const targetNode: UseCaseNode = {
      id: 'usecase-2',
      type: 'USE_CASE',
      name: 'ValidateCredentials',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('should validate a valid Include edge', () => {
      const edge: IncludeEdge = {
        id: 'edge-1',
        type: 'INCLUDE',
        sourceNodeId: 'usecase-1',
        targetNodeId: 'usecase-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateEdge(edge, sourceNode, targetNode);
      expect(result.isValid).toBe(true);
    });

    it('should warn about Extend edge without condition', () => {
      const edge: ExtendEdge = {
        id: 'edge-1',
        type: 'EXTEND',
        sourceNodeId: 'usecase-1',
        targetNodeId: 'usecase-2',
        condition: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateEdge(edge, sourceNode, targetNode);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Extend relationship has no condition specified');
    });

    it('should warn about Extend edge without extension point', () => {
      const edge: ExtendEdge = {
        id: 'edge-1',
        type: 'EXTEND',
        sourceNodeId: 'usecase-1',
        targetNodeId: 'usecase-2',
        condition: 'User has biometrics',
        extensionPoint: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validator.validateEdge(edge, sourceNode, targetNode);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Extend relationship has no extension point specified');
    });
  });
});
