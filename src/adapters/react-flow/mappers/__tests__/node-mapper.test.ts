import { describe, it, expect } from 'vitest';
import {
  mapDomainNodeToView,
  updateViewPosition,
  mapDomainNodesToViews,
  extractPositionMap,
} from '../node-mapper';
import type { ClassNode, InterfaceNode, ActorNode } from '../../../../core/domain/models/nodes';

describe('Node Mapper', () => {
  describe('mapDomainNodeToView', () => {
    it('should map a CLASS domain node to umlClass view node', () => {
      const domainNode: ClassNode = {
        id: 'node-1',
        type: 'CLASS',
        name: 'Patient',
        attributes: [],
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const position = { x: 100, y: 200 };
      const viewNode = mapDomainNodeToView(domainNode, position);

      expect(viewNode.id).toBe('node-1');
      expect(viewNode.domainId).toBe('node-1');
      expect(viewNode.type).toBe('umlClass');
      expect(viewNode.position).toEqual({ x: 100, y: 200 });
      expect(viewNode.data?.domainId).toBe('node-1');
    });

    it('should map an INTERFACE domain node to umlClass view node', () => {
      const domainNode: InterfaceNode = {
        id: 'node-2',
        type: 'INTERFACE',
        name: 'Serializable',
        methods: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const position = { x: 300, y: 400 };
      const viewNode = mapDomainNodeToView(domainNode, position);

      expect(viewNode.type).toBe('umlClass');
      expect(viewNode.position).toEqual({ x: 300, y: 400 });
    });

    it('should map an ACTOR domain node to useCaseActor view node', () => {
      const domainNode: ActorNode = {
        id: 'actor-1',
        type: 'ACTOR',
        name: 'User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const position = { x: 50, y: 50 };
      const viewNode = mapDomainNodeToView(domainNode, position);

      expect(viewNode.type).toBe('useCaseActor');
      expect(viewNode.domainId).toBe('actor-1');
    });

    it('should map a NOTE domain node to umlNote view node', () => {
      const domainNode = {
        id: 'note-1',
        type: 'NOTE',
        content: 'Important note',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as const;

      const position = { x: 0, y: 0 };
      const viewNode = mapDomainNodeToView(domainNode as any, position);

      expect(viewNode.type).toBe('umlNote');
    });
  });

  describe('updateViewPosition', () => {
    it('should update position without modifying other properties', () => {
      const originalView = {
        id: 'node-1',
        domainId: 'node-1',
        type: 'umlClass',
        position: { x: 100, y: 200 },
        selected: true,
        width: 250,
        data: { domainId: 'node-1' },
      };

      const newPosition = { x: 500, y: 600 };
      const updatedView = updateViewPosition(originalView, newPosition);

      expect(updatedView.position).toEqual({ x: 500, y: 600 });
      expect(updatedView.selected).toBe(true);
      expect(updatedView.width).toBe(250);
      expect(updatedView.domainId).toBe('node-1');
    });
  });

  describe('mapDomainNodesToViews', () => {
    it('should batch map multiple domain nodes', () => {
      const domainNodes: ClassNode[] = [
        {
          id: 'node-1',
          type: 'CLASS',
          name: 'Patient',
          attributes: [],
          methods: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'node-2',
          type: 'CLASS',
          name: 'Doctor',
          attributes: [],
          methods: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const positionMap = {
        'node-1': { x: 100, y: 200 },
        'node-2': { x: 300, y: 400 },
      };

      const viewNodes = mapDomainNodesToViews(domainNodes, positionMap);

      expect(viewNodes).toHaveLength(2);
      expect(viewNodes[0].position).toEqual({ x: 100, y: 200 });
      expect(viewNodes[1].position).toEqual({ x: 300, y: 400 });
    });

    it('should use default position {0, 0} for missing position map entries', () => {
      const domainNodes: ClassNode[] = [
        {
          id: 'node-1',
          type: 'CLASS',
          name: 'Patient',
          attributes: [],
          methods: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const positionMap = {};
      const viewNodes = mapDomainNodesToViews(domainNodes, positionMap);

      expect(viewNodes[0].position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('extractPositionMap', () => {
    it('should extract position data from view nodes', () => {
      const viewNodes = [
        {
          id: 'node-1',
          domainId: 'node-1',
          type: 'umlClass',
          position: { x: 100, y: 200 },
          data: { domainId: 'node-1' },
        },
        {
          id: 'node-2',
          domainId: 'node-2',
          type: 'umlClass',
          position: { x: 300, y: 400 },
          data: { domainId: 'node-2' },
        },
      ];

      const positionMap = extractPositionMap(viewNodes);

      expect(positionMap).toEqual({
        'node-1': { x: 100, y: 200 },
        'node-2': { x: 300, y: 400 },
      });
    });
  });
});
