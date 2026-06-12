import { useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { isPackageViewModel, isSystemBoundaryViewModel, isUCModuleViewModel } from '../../adapters/view-models/node.view-model';
import type { NodeBounds } from '../edges/geometry';
import type { ShapeDescriptor } from '../types/canvas.types';
import { undoTransaction } from '../../core/undo/undoBridge';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';
import { getAbsolutePosition } from '../../features/diagram/hooks/controllers/sharedNodeBuilders';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import type { ViewNode, SemanticModel } from '../../core/domain/vfs/vfs.types';
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

/**
 * Re-express a dropped node's stored position when its container changes.
 * Container children store coords RELATIVE to the container; getAbsolutePosition
 * resolves them. We compute the node's current absolute position (via its OLD
 * parent chain), reassign parentPackageId, then re-relativise to the NEW parent
 * — or leave it absolute when removed from all containers. Mutates in place.
 *
 * This unifies package / system-boundary / UC-module containment so a node
 * never jumps (enter) or vanishes near the origin (exit) on reparent.
 */
export function reparentViewNodeCoords(
  viewNodes: ViewNode[],
  droppedNodeId: string,
  newParentId: string | null,
): void {
  const node = viewNodes.find((n) => n.id === droppedNodeId);
  if (!node) return;
  // Absolute position using the CURRENT (old) parent chain — compute BEFORE
  // reassigning parentPackageId.
  const abs = getAbsolutePosition(node, viewNodes);
  node.parentPackageId = newParentId;
  if (newParentId) {
    const parent = viewNodes.find((n) => n.id === newParentId);
    const parentAbs = parent ? getAbsolutePosition(parent, viewNodes) : { x: 0, y: 0 };
    node.x = abs.x - parentAbs.x;
    node.y = abs.y - parentAbs.y;
  } else {
    node.x = abs.x;
    node.y = abs.y;
  }
}

/**
 * Resolve the IRPackage elementId behind a container ViewNode id — but only when
 * it is a real package (system boundaries / UC modules return undefined, so they
 * never touch package indices).
 */
function resolvePackageElementId(
  viewNodeId: string | null,
  viewNodes: Array<{ id: string; elementId: string }>,
  model: SemanticModel,
): string | undefined {
  if (!viewNodeId) return undefined;
  const vn = viewNodes.find((n) => n.id === viewNodeId);
  if (!vn) return undefined;
  return model.packages?.[vn.elementId] ? vn.elementId : undefined;
}

/** IRPackage reverse-index array name for an element kind, or null if unindexed. */
function pkgIndexKeyForKind(
  kind: string | undefined,
): 'classIds' | 'interfaceIds' | 'enumIds' | 'dataTypeIds' | null {
  switch (kind) {
    case 'CLASS': return 'classIds';
    case 'INTERFACE': return 'interfaceIds';
    case 'ENUM': return 'enumIds';
    case 'DATATYPE': return 'dataTypeIds';
    default: return null;
  }
}

/**
 * Keep IRPackage reverse indices consistent when an element moves between
 * packages: drop elementId from the old package's array, add it to the new one.
 */
export function moveElementInPackageIndex(
  model: SemanticModel,
  elementId: string,
  kind: string | undefined,
  oldPkgId: string | undefined,
  newPkgId: string | undefined,
): void {
  const key = pkgIndexKeyForKind(kind);
  if (!key || !model.packages) return;
  if (oldPkgId && oldPkgId !== newPkgId && model.packages[oldPkgId]) {
    const arr = model.packages[oldPkgId][key] as string[] | undefined;
    if (arr) model.packages[oldPkgId][key] = arr.filter((id) => id !== elementId);
  }
  if (newPkgId && model.packages[newPkgId]) {
    const arr = (model.packages[newPkgId][key] as string[] | undefined) ?? [];
    if (!arr.includes(elementId)) model.packages[newPkgId][key] = [...arr, elementId];
  }
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

      const isPackageDrop = droppedShape?.data && isPackageViewModel(droppedShape.data);
      const isBoundaryDrop = droppedShape?.data && isSystemBoundaryViewModel(droppedShape.data);
      const isModuleDrop = droppedShape?.data && isUCModuleViewModel(droppedShape.data);

      // Containers can't be nested inside other things
      if (isBoundaryDrop || isModuleDrop) return;

      // Determine if target is a package, a system boundary, or a UC module
      const targetShape = targetPackageId ? shapes.find((s) => s.id === targetPackageId) : null;
      const targetIsBoundary = targetShape ? isSystemBoundaryViewModel(targetShape.data) : false;
      const targetIsModule = targetShape ? isUCModuleViewModel(targetShape.data) : false;

      // Pre-compute the effective package path (walks ViewNode hierarchy) so we can
      // write element.packageName and keep the Model Explorer in sync.
      // Skip for boundary/module targets — UC actors/use cases have no packageName.
      let effectivePkgPath: string | undefined;
      if (!isPackageDrop && !targetIsBoundary && !targetIsModule) {
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
        ? targetIsBoundary
          ? `Move into boundary: ${packageName ?? targetPackageId}`
          : targetIsModule
          ? `Move into module: ${packageName ?? targetPackageId}`
          : `Move into package: ${packageName ?? targetPackageId}`
        : 'Remove from container';

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
              // Unified reparent: keeps absolute screen position stable whether
              // entering, leaving, or moving between containers (fixes the
              // "class vanishes when dragged out of a package" bug).
              reparentViewNodeCoords(file.content.nodes, droppedNodeId, targetPackageId);

              // Sync semantic membership in localModel: packageName (dotted path),
              // packageId (stable key) and the IRPackage reverse index.
              if (!isPackageDrop && file.localModel) {
                const droppedVN = file.content.nodes.find((vn: any) => vn.id === droppedNodeId);
                if (droppedVN) {
                  const lm = file.localModel as SemanticModel;
                  const el = lm.classes?.[droppedVN.elementId]
                    ?? lm.interfaces?.[droppedVN.elementId]
                    ?? lm.enums?.[droppedVN.elementId];
                  if (el) {
                    const newPkgId = resolvePackageElementId(targetPackageId, file.content.nodes, lm);
                    const oldPkgId = resolvePackageElementId(currentParentId, file.content.nodes, lm);
                    el.packageName = effectivePkgPath;
                    (el as { packageId?: string }).packageId = newPkgId;
                    moveElementInPackageIndex(lm, el.id, el.kind, oldPkgId, newPkgId);
                    lm.updatedAt = Date.now();
                  }
                }
              }
            },
          }],
          affectedElementIds: [droppedNodeId],
        });
      } else {
        // Global: VFS mutation for parentPackageId, model mutation for packageName.
        const mutations: Array<{ store: 'vfs' | 'model'; mutate: (draft: any) => void }> = [
          {
            store: 'vfs',
            mutate: (draft: any) => {
              const file = draft.project.nodes[activeTabId];
              if (!isDiagramView(file.content)) return;
              reparentViewNodeCoords(file.content.nodes, droppedNodeId, targetPackageId);
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
              const model = draft.model as SemanticModel;
              const el = model.classes[droppedVN.elementId]
                ?? model.interfaces[droppedVN.elementId]
                ?? model.enums[droppedVN.elementId];
              if (el) {
                const newPkgId = resolvePackageElementId(targetPackageId, file.content.nodes, model);
                const oldPkgId = resolvePackageElementId(currentParentId, file.content.nodes, model);
                el.packageName = effectivePkgPath;
                (el as { packageId?: string }).packageId = newPkgId;
                moveElementInPackageIndex(model, el.id, el.kind, oldPkgId, newPkgId);
                model.updatedAt = Date.now();
              }
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
        const bounds = boundsMap.get(shape.id);
        if (!bounds) continue;
        if (shape.type === 'package' && isPackageViewModel(shape.data)) {
          packageBoundsMap.set(shape.id, {
            bounds,
            name: shape.data.name,
            depth: shape.data.depth,
          });
        } else if (isSystemBoundaryViewModel(shape.data)) {
          // System boundaries act as containers with depth 0 (below packages)
          packageBoundsMap.set(shape.id, {
            bounds,
            name: shape.data.name,
            depth: 0,
          });
        } else if (isUCModuleViewModel(shape.data)) {
          // UC modules act as containers with depth 0
          packageBoundsMap.set(shape.id, {
            bounds,
            name: shape.data.name,
            depth: 0,
          });
        }
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
