import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useProjectStore } from '../../../../store/project.store';
import { LayoutService, type LayoutDirection } from '../../../../services/layout.service';

/**
 * Layout Actions Hook
 * 
 * Provides auto-layout functionality using Dagre algorithm.
 * Integrates with SSOT architecture (WorkspaceStore + ProjectStore).
 * 
 * Features:
 * - Automatic graph layout (Top-Bottom or Left-Right)
 * - Handles disconnected nodes gracefully
 * - Updates position map in WorkspaceStore
 * - Triggers React Flow fitView after layout
 */
export const useLayoutActions = () => {
  const { fitView } = useReactFlow();

  // WorkspaceStore
  const getActiveFile = useWorkspaceStore((s) => s.getActiveFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const markFileDirty = useWorkspaceStore((s) => s.markFileDirty);

  // ProjectStore
  const getNodes = useProjectStore((s) => s.getNodes);
  const getEdges = useProjectStore((s) => s.getEdges);

  /**
   * Apply automatic layout to the current diagram
   * 
   * @param direction - Layout direction ('TB' for top-bottom, 'LR' for left-right)
   */
  const applyAutoLayout = useCallback(
    (direction: LayoutDirection = 'TB') => {
      const activeFile = getActiveFile();

      if (!activeFile) {
        console.warn('[LayoutActions] No active file');
        return;
      }

      if (activeFile.nodeIds.length === 0) {
        console.warn('[LayoutActions] No nodes to layout');
        return;
      }

      try {
        console.log(`[LayoutActions] Applying ${direction} layout to ${activeFile.nodeIds.length} nodes...`);

        // Get domain data
        const nodes = getNodes(activeFile.nodeIds);
        const edges = getEdges(activeFile.edgeIds);

        // Calculate new positions using Dagre
        const newPositionMap = LayoutService.applyAutoLayout(nodes, edges, direction);

        // Center the layout for better viewport fitting
        const centeredPositionMap = LayoutService.centerLayout(newPositionMap, {
          nodeWidth: 250,
          nodeHeight: 200,
          rankSep: 100,
          nodeSep: 80,
          edgeSep: 20,
          marginX: 50,
          marginY: 50,
        });

        // Update WorkspaceStore with new positions
        const metadata = activeFile.metadata as any;
        updateFile(activeFile.id, {
          metadata: {
            ...metadata,
            positionMap: centeredPositionMap,
          } as any,
        });

        // Mark file as dirty (layout change)
        markFileDirty(activeFile.id);

        // Fit view to show all nodes after layout
        // Use setTimeout to ensure React Flow has updated with new positions
        setTimeout(() => {
          fitView({
            duration: 800,
            padding: 0.1,
          });
        }, 50);

        console.log('[LayoutActions] ✓ Layout applied successfully');
      } catch (error) {
        console.error('[LayoutActions] Error applying layout:', error);
      }
    },
    [getActiveFile, getNodes, getEdges, updateFile, markFileDirty, fitView]
  );

  return {
    applyAutoLayout,
  };
};
