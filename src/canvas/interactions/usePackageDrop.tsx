import { useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { isPackageViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import type { NodeBounds } from '../edges/geometry';
import type { ShapeDescriptor } from '../types/canvas.types';
import { undoTransaction } from '../../core/undo/undoBridge';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import PackageDropPicker, { type PackageCandidate } from '../overlays/PackageDropPicker';

const AMBIGUOUS_THRESHOLD = 50;

interface PendingDrop {
  droppedNodeId: string;
  candidates: PackageCandidate[];
  screenPos: { x: number; y: number };
}

export interface UsePackageDropOptions {
  shapes: ShapeDescriptor[];
  boundsMap: Map<string, NodeBounds>;
  activeTabId: string;
  isStandalone?: boolean;
}

export interface UsePackageDropReturn {
  pendingDrop: PendingDrop | null;
  onDragEndWithPackageDetection: (e: KonvaEventObject<MouseEvent>) => void;
  PackageDropPicker: ReactNode;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Walks the package ViewNode hierarchy to compute the full dotted package path
 * (e.g. "Infrastructure.ServiceLayer") for a given target ViewNode.
 * This is the value that should be written to element.packageName.
 */
function computeEffectivePkgPath(
  targetViewNodeId: string | null,
  viewNodes: Array<{ id: string; elementId: string; parentPackageId?: string | null }>,
  packages: Record<string, { name: string }>,
): string | undefined {
  if (!targetViewNodeId) return undefined;
  const vnMap = new Map(viewNodes.map((vn) => [vn.id, vn]));
  const path: string[] = [];
  let currentId: string | null = targetViewNodeId;
  for (let depth = 0; currentId && depth < 10; depth++) {
    const vn = vnMap.get(currentId);
    if (!vn) break;
    const pkg = packages[vn.elementId];
    if (!pkg) break;
    path.unshift(pkg.name);
    currentId = vn.parentPackageId ?? null;
  }
  return path.length > 0 ? path.join('.') : undefined;
}

function collectDescendantIds(nodeId: string, shapes: ShapeDescriptor[]): Set<string> {
  const result = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    for (const shape of shapes) {
      if (shape.parentPackageId === parentId && !result.has(shape.id)) {
        result.add(shape.id);
        queue.push(shape.id);
      }
    }
  }
  return result;
}

function detectOverlappingPackages(
  dropPoint: { x: number; y: number },
  packageBoundsMap: Map<string, { bounds: NodeBounds; name: string; depth: number }>,
  excludeIds: Set<string>,
): PackageCandidate[] {
  const candidates: PackageCandidate[] = [];

  for (const [viewNodeId, { bounds, name, depth }] of packageBoundsMap.entries()) {
    if (excludeIds.has(viewNodeId)) continue;

    const { x, y, width, height } = bounds;
    if (
      dropPoint.x < x ||
      dropPoint.x > x + width ||
      dropPoint.y < y ||
      dropPoint.y > y + height
    ) continue;

    const distanceToBorder = Math.min(
      dropPoint.x - x,
      x + width - dropPoint.x,
      dropPoint.y - y,
      y + height - dropPoint.y,
    );

    candidates.push({ viewNodeId, packageName: name, depth, distanceToBorder });
  }

  candidates.sort((a, b) => b.depth - a.depth);
  return candidates;
}

export function usePackageDrop({
  shapes,
  boundsMap,
  activeTabId,
  isStandalone = false,
}: UsePackageDropOptions): UsePackageDropReturn {
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);

  const commitAssignment = useCallback(
    (droppedNodeId: string, targetPackageId: string | null, packageName?: string) => {
      const droppedShape = shapes.find((s) => s.id === droppedNodeId);
      const currentParentId = droppedShape?.parentPackageId ?? null;
      if (currentParentId === targetPackageId) return;

      const isPackageDrop = isPackageViewModel(droppedShape?.data);

      // Pre-compute the effective package path (walks ViewNode hierarchy) so we can
      // write element.packageName and keep the Model Explorer in sync.
      let effectivePkgPath: string | undefined;
      if (!isPackageDrop) {
        const vfsProject = useVFSStore.getState().project;
        const file = vfsProject?.nodes[activeTabId] as any;
        if (file && isDiagramView(file.content)) {
          const model = isStandalone
            ? file.localModel
            : useModelStore.getState().model;
          if (model?.packages) {
            effectivePkgPath = computeEffectivePkgPath(
              targetPackageId,
              file.content.nodes,
              model.packages,
            );
          }
        }
      }

      const label = targetPackageId
        ? `Move into package: ${packageName ?? targetPackageId}`
        : 'Remove from package';

      if (isStandalone) {
        // Standalone: all mutations live in the VFS store (localModel + content).
        undoTransaction({
          label,
          scope: activeTabId,
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const file = draft.project.nodes[activeTabId];
              if (!isDiagramView(file.content)) return;
              const viewNode = file.content.nodes.find((vn: any) => vn.id === droppedNodeId);
              if (viewNode) viewNode.parentPackageId = targetPackageId;
              // Sync element.packageName in localModel
              if (!isPackageDrop && file.localModel) {
                const droppedVN = file.content.nodes.find((vn: any) => vn.id === droppedNodeId);
                if (droppedVN) {
                  const el = file.localModel.classes?.[droppedVN.elementId]
                    ?? file.localModel.interfaces?.[droppedVN.elementId]
                    ?? file.localModel.enums?.[droppedVN.elementId];
                  if (el) { el.packageName = effectivePkgPath; file.localModel.updatedAt = Date.now(); }
                }
              }
            },
          }],
          affectedElementIds: [droppedNodeId],
        });
      } else {
        // Global: VFS mutation for parentPackageId, model mutation for packageName.
        const mutations: Array<{ store: string; mutate: (draft: any) => void }> = [
          {
            store: 'vfs',
            mutate: (draft: any) => {
              const file = draft.project.nodes[activeTabId];
              if (!isDiagramView(file.content)) return;
              const viewNode = file.content.nodes.find((vn: any) => vn.id === droppedNodeId);
              if (viewNode) viewNode.parentPackageId = targetPackageId;
            },
          },
        ];

        if (!isPackageDrop) {
          mutations.push({
            store: 'model',
            mutate: (draft: any) => {
              if (!draft.model) return;
              const vfsProject = useVFSStore.getState().project;
              const file = vfsProject?.nodes[activeTabId] as any;
              if (!file || !isDiagramView(file.content)) return;
              const droppedVN = file.content.nodes.find((vn: any) => vn.id === droppedNodeId);
              if (!droppedVN) return;
              const el = draft.model.classes[droppedVN.elementId]
                ?? draft.model.interfaces[droppedVN.elementId]
                ?? draft.model.enums[droppedVN.elementId];
              if (el) { el.packageName = effectivePkgPath; draft.model.updatedAt = Date.now(); }
            },
          });
        }

        undoTransaction({
          label,
          scope: 'global',
          mutations,
          affectedElementIds: [droppedNodeId],
        });
      }
    },
    [shapes, activeTabId, isStandalone],
  );

  const onDragEndWithPackageDetection = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const nodeId = e.target.id();
      if (!nodeId) return;

      const packageBoundsMap = new Map<
        string,
        { bounds: NodeBounds; name: string; depth: number }
      >();
      for (const shape of shapes) {
        if (shape.type !== 'package') continue;
        if (!isPackageViewModel(shape.data)) continue;
        const bounds = boundsMap.get(shape.id);
        if (!bounds) continue;
        packageBoundsMap.set(shape.id, {
          bounds,
          name: shape.data.name,
          depth: shape.data.depth,
        });
      }

      const nodeBounds = boundsMap.get(nodeId);
      const dropPoint = {
        x: e.target.x() + (nodeBounds ? nodeBounds.width / 2 : 0),
        y: e.target.y() + (nodeBounds ? nodeBounds.height / 2 : 0),
      };

      const excludeIds = collectDescendantIds(nodeId, shapes);
      const candidates = detectOverlappingPackages(dropPoint, packageBoundsMap, excludeIds);

      if (candidates.length === 0) {
        commitAssignment(nodeId, null);
        return;
      }

      if (candidates.length === 1) {
        commitAssignment(nodeId, candidates[0].viewNodeId, candidates[0].packageName);
        return;
      }

      const innermost = candidates[0];
      if (innermost.distanceToBorder >= AMBIGUOUS_THRESHOLD) {
        commitAssignment(nodeId, innermost.viewNodeId, innermost.packageName);
        return;
      }

      setPendingDrop({
        droppedNodeId: nodeId,
        candidates,
        screenPos: { x: e.evt.clientX, y: e.evt.clientY },
      });
    },
    [shapes, boundsMap, commitAssignment],
  );

  const handleSelect = useCallback(
    (viewNodeId: string | null) => {
      if (!pendingDrop) return;
      const candidate = pendingDrop.candidates.find((c) => c.viewNodeId === viewNodeId);
      commitAssignment(pendingDrop.droppedNodeId, viewNodeId, candidate?.packageName);
      setPendingDrop(null);
    },
    [pendingDrop, commitAssignment],
  );

  const handleCancel = useCallback(() => {
    if (!pendingDrop) return;
    commitAssignment(pendingDrop.droppedNodeId, null);
    setPendingDrop(null);
  }, [pendingDrop, commitAssignment]);

  useEffect(() => {
    if (!pendingDrop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingDrop, handleCancel]);

  const PickerComponent = pendingDrop ? (
    <PackageDropPicker
      candidates={pendingDrop.candidates}
      screenPos={pendingDrop.screenPos}
      onSelect={handleSelect}
      onCancel={handleCancel}
    />
  ) : null;

  return { pendingDrop, onDragEndWithPackageDetection, PackageDropPicker: PickerComponent };
}
