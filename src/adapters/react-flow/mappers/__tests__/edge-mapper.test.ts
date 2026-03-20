import { describe, it, expect } from 'vitest';
import {
  mapDomainEdgeToView,
  updateEdgeHoverState,
  updateEdgeSelectionState,
  mapDomainEdgesToViews,
  updateEdgeHandles,
} from '../edge-mapper';
import type { AssociationEdge, InheritanceEdge, IncludeEdge } from '../../../../core/domain/models/edges';

describe('Edge Mapper', () => {
  describe('mapDomainEdgeToView', () => {
    it('should map an ASSOCIATION domain edge to view edge', () => {
      const domainEdge: AssociationEdge = {
        id: 'edge-1',
        type: 'ASSOCIATION',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const viewEdge = mapDomainEdgeToView(domainEdge);

      expect(viewEdge.id).toBe('edge-1');
      expect(viewEdge.domainId).toBe('edge-1');
      expect(viewEdge.source).toBe('node-1');
      expect(viewEdge.target).toBe('node-2');
      expect(viewEdge.type).toBe('umlEdge');
      expect(viewEdge.data?.domainId).toBe('edge-1');
      expect(viewEdge.data?.isHovered).toBe(false);
    });

    it('should map an INHERITANCE domain edge with correct styling', () => {
      const domainEdge: InheritanceEdge = {
        id: 'edge-2',
        type: 'INHERITANCE',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const viewEdge = mapDomainEdgeToView(domainEdge);

      expect(viewEdge.type).toBe('umlEdge');
      expect(viewEdge.style?.strokeWidth).toBe(2);
      expect(viewEdge.markerEnd).toBeDefined();
    });

    it('should map an IMPLEMENTATION edge with dashed style', () => {
      const domainEdge = {
        id: 'edge-3',
        type: 'IMPLEMENTATION',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as const;

      const viewEdge = mapDomainEdgeToView(domainEdge as any);

      expect(viewEdge.style?.strokeDasharray).toBe('5,5');
    });

    it('should map a Use Case INCLUDE edge', () => {
      const domainEdge: IncludeEdge = {
        id: 'edge-4',
        type: 'INCLUDE',
        sourceNodeId: 'usecase-1',
        targetNodeId: 'usecase-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const viewEdge = mapDomainEdgeToView(domainEdge);

      expect(viewEdge.type).toBe('umlEdge');
      expect(viewEdge.style?.strokeDasharray).toBe('5,5');
    });
  });

  describe('updateEdgeHoverState', () => {
    it('should update hover state without modifying other properties', () => {
      const originalView = {
        id: 'edge-1',
        domainId: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'umlEdge',
        data: {
          domainId: 'edge-1',
          isHovered: false,
        },
      };

      const updatedView = updateEdgeHoverState(originalView, true);

      expect(updatedView.data?.isHovered).toBe(true);
      expect(updatedView.id).toBe('edge-1');
      expect(updatedView.source).toBe('node-1');
    });
  });

  describe('updateEdgeSelectionState', () => {
    it('should update selection state', () => {
      const originalView = {
        id: 'edge-1',
        domainId: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'umlEdge',
        selected: false,
      };

      const updatedView = updateEdgeSelectionState(originalView, true);

      expect(updatedView.selected).toBe(true);
    });
  });

  describe('mapDomainEdgesToViews', () => {
    it('should batch map multiple domain edges', () => {
      const domainEdges: AssociationEdge[] = [
        {
          id: 'edge-1',
          type: 'ASSOCIATION',
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'edge-2',
          type: 'ASSOCIATION',
          sourceNodeId: 'node-2',
          targetNodeId: 'node-3',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const viewEdges = mapDomainEdgesToViews(domainEdges);

      expect(viewEdges).toHaveLength(2);
      expect(viewEdges[0].source).toBe('node-1');
      expect(viewEdges[1].source).toBe('node-2');
    });
  });

  describe('updateEdgeHandles', () => {
    it('should update source and target handles', () => {
      const originalView = {
        id: 'edge-1',
        domainId: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'umlEdge',
        sourceHandle: null,
        targetHandle: null,
      };

      const updatedView = updateEdgeHandles(originalView, 'right', 'left');

      expect(updatedView.sourceHandle).toBe('right');
      expect(updatedView.targetHandle).toBe('left');
      expect(updatedView.id).toBe('edge-1');
    });
  });
});
