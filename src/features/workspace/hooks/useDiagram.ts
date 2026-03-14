import { useCallback, useMemo, useState, useEffect } from 'react';
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
import { useShallow } from 'zustand/react/shallow';
import { getNextDefaultName } from '../../../core/utils/name-generator.util';

interface PositionMap {
  [nodeId: string]: { x: number; y: number };
}

export function useDiagram(fileId?: string) {
  const [isHydrated, setIsHydrated] = useState(() => 
    useProjectStore.persist.hasHydrated() && useWorkspaceStore.persist.hasHydrated()
  );

  useEffect(() => {
    const checkHydration = () => {
      setIsHydrated(useProjectStore.persist.hasHydrated() && useWorkspaceStore.persist.hasHydrated());
    };
    const unsubProject = useProjectStore.persist.onFinishHydration(checkHydration);
    const unsubWorkspace = useWorkspaceStore.persist.onFinishHydration(checkHydration);
    checkHydration();
    return () => {
      unsubProject();
      unsubWorkspace();
    };
  }, []);

  const globalActiveId = useWorkspaceStore((s) => s.activeFileId);
  const targetFileId = fileId || globalActiveId;
  const file = useWorkspaceStore(useShallow(s => targetFileId ? s.getFile(targetFileId) : undefined));

  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const addNodeToFile = useWorkspaceStore((s) => s.addNodeToFile);
  const addEdgeToFile = useWorkspaceStore((s) => s.addEdgeToFile);
  const removeNodeFromFile = useWorkspaceStore((s) => s.removeNodeFromFile);
  const removeEdgeFromFile = useWorkspaceStore((s) => s.removeEdgeFromFile);
  const markFileDirty = useWorkspaceStore((s) => s.markFileDirty);

  const addNode = useProjectStore((s) => s.addNode);
  const addEdge = useProjectStore((s) => s.addEdge);
  const removeNode = useProjectStore((s) => s.removeNode);
  const removeEdge = useProjectStore((s) => s.removeEdge);
  const getEdgesForNode = useProjectStore((s) => s.getEdgesForNode);

  const positionMap: PositionMap = useWorkspaceStore(useShallow(state => {
    if (!targetFileId) return {};
    const f = state.getFile(targetFileId);
    return (f?.metadata as any)?.positionMap || {};
  }));

  const domainNodes = useProjectStore(useShallow(s => file ? s.getNodes(file.nodeIds) : []));
  const domainEdges = useProjectStore(useShallow(s => file ? s.getEdges(file.edgeIds) : []));

  const viewNodes: NodeView[] = useMemo(() => {
    return mapDomainNodesToViews(domainNodes, positionMap);
  }, [domainNodes, positionMap]);

  const viewEdges: EdgeView[] = useMemo(() => {
    return mapDomainEdgesToViews(domainEdges);
  }, [domainEdges]);

  const registry = useMemo(() => {
    if (!file || !isHydrated) return null;
    return getDiagramRegistry(file.diagramType);
  }, [file, isHydrated]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!file || !targetFileId) return;

      const positionChanges = changes.filter(
        (change) => change.type === 'position' && change.position
      );

      if (positionChanges.length > 0) {
        const newPositionMap = { ...positionMap };
        
        positionChanges.forEach((change) => {
          if (change.type === 'position' && change.position) {
            newPositionMap[change.id] = change.position;
          }
        });

        updateFile(targetFileId, {
          metadata: {
            ...file.metadata,
            positionMap: newPositionMap,
          } as any,
        });

        if (positionChanges.some((c) => c.type === 'position' && !c.dragging)) {
          markFileDirty(targetFileId);
        }
      }

      const removeChanges = changes.filter((change) => change.type === 'remove');
      if (removeChanges.length > 0) {
        removeChanges.forEach((change) => {
          if (change.type === 'remove') {
            const nodeId = change.id;

            removeNodeFromFile(targetFileId, nodeId);

            const connectedEdges = getEdgesForNode(nodeId);
            connectedEdges.forEach((edge) => {
              removeEdgeFromFile(targetFileId, edge.id);
              removeEdge(edge.id);
            });

            removeNode(nodeId);
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
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!file || !targetFileId) return;

      const removeChanges = changes.filter((change) => change.type === 'remove');
      if (removeChanges.length > 0) {
        removeChanges.forEach((change) => {
          if (change.type === 'remove') {
            const edgeId = change.id;
            removeEdgeFromFile(targetFileId, edgeId);
            removeEdge(edgeId);
          }
        });

        markFileDirty(targetFileId);
      }
    },
    [file, targetFileId, removeEdgeFromFile, removeEdge, markFileDirty]
  );
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!file || !targetFileId || !registry) return;
      if (!connection.source || !connection.target) return;

      const sourceNode = domainNodes.find((n) => n.id === connection.source);
      const targetNode = domainNodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) {
        console.warn('Cannot create connection: source or target node not found');
        return;
      }

      const metadata = file.metadata as any;
      let edgeType = metadata?.activeConnectionMode || registry.defaultEdgeType;
      
      // Enforce uppercase edge types for validation/creation registry keys
      edgeType = edgeType.toUpperCase();

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
        console.error('Invalid connection:', validationResult.errors?.[0]);
        return;
      }

      const newEdge = registry.factories.createEdge(
        edgeType,
        connection.source,
        connection.target
      );

      addEdge(newEdge);
      addEdgeToFile(targetFileId, newEdge.id);
      markFileDirty(targetFileId);
    },
    [
      file,
      targetFileId,
      registry,
      domainNodes,
      domainEdges,
      addEdge,
      addEdgeToFile,
      markFileDirty,
    ]
  );
  return {
    nodes: viewNodes,
    edges: viewEdges,

    onNodesChange,
    onEdgesChange,
    onConnect,

    file,
    registry,
    isReady: !!file && !!registry,

    addNodeToDiagram: useCallback(
      (nodeType: string, position: { x: number; y: number }) => {
        if (!file || !targetFileId || !registry) return;

        const newNode = registry.factories.createNode(nodeType);
        
        // Generate a clean default name based on existing SSOT nodes
        const currentProjectNodes = useProjectStore.getState().nodes;
        const defaultName = getNextDefaultName(Object.values(currentProjectNodes), nodeType);
        (newNode as any).name = defaultName;

        addNode(newNode);

        addNodeToFile(targetFileId, newNode.id);

        const newPositionMap = {
          ...positionMap,
          [newNode.id]: position,
        };

        updateFile(targetFileId, {
          metadata: {
            ...file.metadata,
            positionMap: newPositionMap,
          } as any,
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
