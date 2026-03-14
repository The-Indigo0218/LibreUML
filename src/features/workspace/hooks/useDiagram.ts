import { useCallback, useMemo } from 'react';
import { type NodeChange, type EdgeChange, type Connection } from 'reactflow';
import { useProjectStore } from '../../../store/project.store';
import { useWorkspaceStore } from '../../../store/workspace.store';
import { getDiagramRegistry } from '../../../core/registry/diagram-registry';
import {
  mapDomainNodesToViews,
  mapDomainEdgesToViews,
} from '../../../adapters/react-flow/mappers';
import type { NodeView } from '../../../adapters/react-flow/view-models/node-view.types';
import type { EdgeView } from '../../../adapters/react-flow/view-models/edge-view.types';
import type { DomainNode } from '../../../core/domain/models/nodes';

/**
 * Position map stored per file for UI state
 * This is separate from domain data
 */
interface PositionMap {
  [nodeId: string]: { x: number; y: number };
}

/**
 * Integration Hook - Connects SSOT Architecture to React Flow
 * 
 * This hook bridges:
 * - ProjectStore (SSOT domain data)
 * - WorkspaceStore (file/tab management)
 * - Mappers (domain ↔ view transformation)
 * - React Flow (UI rendering)
 * 
 * @param fileId - Optional file ID. If not provided, uses active file.
 * @returns React Flow compatible props and handlers
 */
export function useDiagram(fileId?: string) {
  // === Store Selectors ===
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const getFile = useWorkspaceStore((s) => s.getFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const addNodeToFile = useWorkspaceStore((s) => s.addNodeToFile);
  const addEdgeToFile = useWorkspaceStore((s) => s.addEdgeToFile);
  const removeNodeFromFile = useWorkspaceStore((s) => s.removeNodeFromFile);
  const removeEdgeFromFile = useWorkspaceStore((s) => s.removeEdgeFromFile);
  const markFileDirty = useWorkspaceStore((s) => s.markFileDirty);

  const getNodes = useProjectStore((s) => s.getNodes);
  const getEdges = useProjectStore((s) => s.getEdges);
  const addNode = useProjectStore((s) => s.addNode);
  const addEdge = useProjectStore((s) => s.addEdge);
  const removeNode = useProjectStore((s) => s.removeNode);
  const removeEdge = useProjectStore((s) => s.removeEdge);
  const getEdgesForNode = useProjectStore((s) => s.getEdgesForNode);

  // Determine which file to use
  const targetFileId = fileId || activeFileId;
  const file = targetFileId ? getFile(targetFileId) : undefined;

  // Get position map from file metadata (or initialize empty)
  const positionMap: PositionMap = useMemo(() => {
    if (!file) return {};
    // Position map is stored in file metadata for now
    // In a production system, this might be in a separate store
    return (file.metadata as any)?.positionMap || {};
  }, [file]);

  // === Domain Data Fetching ===
  const domainNodes = useMemo(() => {
    if (!file) return [];
    return getNodes(file.nodeIds);
  }, [file, getNodes]);

  const domainEdges = useMemo(() => {
    if (!file) return [];
    return getEdges(file.edgeIds);
  }, [file, getEdges]);

  // === View Transformation ===
  const viewNodes: NodeView[] = useMemo(() => {
    return mapDomainNodesToViews(domainNodes, positionMap);
  }, [domainNodes, positionMap]);

  const viewEdges: EdgeView[] = useMemo(() => {
    return mapDomainEdgesToViews(domainEdges);
  }, [domainEdges]);

  // === Get Diagram Registry ===
  const registry = useMemo(() => {
    if (!file) return null;
    return getDiagramRegistry(file.diagramType);
  }, [file]);

  // === React Flow Handlers ===

  /**
   * Handles node changes (drag, select, remove)
   * CRITICAL: Only position changes update the position map.
   * Domain data in ProjectStore is never touched here.
   */
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!file || !targetFileId) return;

      // Extract position changes and update position map
      const positionChanges = changes.filter(
        (change) => change.type === 'position' && change.dragging === false
      );

      if (positionChanges.length > 0) {
        // Build updated position map from changes
        const newPositionMap = { ...positionMap };
        
        positionChanges.forEach((change) => {
          if (change.type === 'position' && change.position) {
            newPositionMap[change.id] = change.position;
          }
        });

        // Update file metadata with new positions
        updateFile(targetFileId, {
          metadata: {
            ...file.metadata,
            positionMap: newPositionMap,
          } as any, // Type assertion needed due to discriminated union complexity
        });

        markFileDirty(targetFileId);
      }

      // Handle node removal
      const removeChanges = changes.filter((change) => change.type === 'remove');
      if (removeChanges.length > 0) {
        removeChanges.forEach((change) => {
          if (change.type === 'remove') {
            const nodeId = change.id;

            // Remove from file
            removeNodeFromFile(targetFileId, nodeId);

            // Remove connected edges from file
            const connectedEdges = getEdgesForNode(nodeId);
            connectedEdges.forEach((edge) => {
              removeEdgeFromFile(targetFileId, edge.id);
            });

            // Remove from SSOT (domain)
            // Note: In production, you might want to keep orphaned nodes
            // and only remove them when explicitly deleted
            removeNode(nodeId);
            connectedEdges.forEach((edge) => removeEdge(edge.id));
          }
        });

        markFileDirty(targetFileId);
      }
    },
    [
      file,
      targetFileId,
      positionMap,
      updateFile,
      markFileDirty,
      removeNodeFromFile,
      removeEdgeFromFile,
      getEdgesForNode,
      removeNode,
      removeEdge,
    ]
  );

  /**
   * Handles edge changes (select, remove)
   */
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!file || !targetFileId) return;

      // Handle edge removal
      const removeChanges = changes.filter((change) => change.type === 'remove');
      if (removeChanges.length > 0) {
        removeChanges.forEach((change) => {
          if (change.type === 'remove') {
            const edgeId = change.id;

            // Remove from file
            removeEdgeFromFile(targetFileId, edgeId);

            // Remove from SSOT (domain)
            removeEdge(edgeId);
          }
        });

        markFileDirty(targetFileId);
      }
    },
    [file, targetFileId, removeEdgeFromFile, removeEdge, markFileDirty]
  );

  /**
   * Handles new connections (drawing edges between nodes)
   * CRITICAL: Validates connection using registry validator before creating edge.
   */
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!file || !targetFileId || !registry) return;
      if (!connection.source || !connection.target) return;

      // Get source and target domain nodes
      const sourceNode = domainNodes.find((n) => n.id === connection.source);
      const targetNode = domainNodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) {
        console.warn('Cannot create connection: source or target node not found');
        return;
      }

      // Get active connection mode from file metadata
      const metadata = file.metadata as any;
      const edgeType = metadata?.activeConnectionMode || registry.defaultEdgeType;

      // Validate connection using registry validator
      const validationResult = registry.validator.validateConnection(
        sourceNode,
        targetNode,
        edgeType,
        domainEdges,
        domainNodes.reduce((acc, node) => {
          acc[node.id] = node;
          return acc;
        }, {} as Record<string, DomainNode>)
      );

      if (!validationResult.isValid) {
        // Show error to user (you can integrate with toast/notification system)
        console.error('Invalid connection:', validationResult.errors?.[0]);
        // TODO: Integrate with useUiStore to show toast
        return;
      }

      // Create edge using registry factory
      const newEdge = registry.factories.createEdge(
        edgeType,
        connection.source,
        connection.target
      );

      // Add to SSOT (domain)
      addEdge(newEdge);

      // Add to file
      addEdgeToFile(targetFileId, newEdge.id);

      markFileDirty(targetFileId);
    },
    [
      file,
      targetFileId,
      registry,
      domainNodes,
      addEdge,
      addEdgeToFile,
      markFileDirty,
    ]
  );

  // === Return React Flow Props ===
  return {
    // View data (React Flow compatible)
    nodes: viewNodes,
    edges: viewEdges,

    // Event handlers
    onNodesChange,
    onEdgesChange,
    onConnect,

    // Metadata
    file,
    registry,
    isReady: !!file && !!registry,

    // Helper functions for adding nodes
    addNodeToDiagram: useCallback(
      (nodeType: string, position: { x: number; y: number }) => {
        if (!file || !targetFileId || !registry) return;

        // Create node using registry factory
        const newNode = registry.factories.createNode(nodeType);

        // Add to SSOT (domain)
        addNode(newNode);

        // Add to file
        addNodeToFile(targetFileId, newNode.id);

        // Update position map
        const newPositionMap = {
          ...positionMap,
          [newNode.id]: position,
        };

        updateFile(targetFileId, {
          metadata: {
            ...file.metadata,
            positionMap: newPositionMap,
          } as any, // Type assertion needed due to discriminated union complexity
        });

        markFileDirty(targetFileId);

        return newNode;
      },
      [
        file,
        targetFileId,
        registry,
        positionMap,
        addNode,
        addNodeToFile,
        updateFile,
        markFileDirty,
      ]
    ),
  };
}
