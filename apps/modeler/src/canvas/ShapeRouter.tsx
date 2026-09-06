import type React from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import type {
  AnyNodeViewModel,
  NodeViewModel,
} from '../adapters/view-models/node.view-model';
import { getNodeKind } from '../adapters/view-models/node-kind';
import { NODE_KIND_DESCRIPTORS, type NodeRenderArgs } from './nodeKindDescriptors';
import ClassShape, { getClassShapeSize } from './shapes/ClassShape';

export interface NodeShapeRenderProps {
  key: string;
  x: number;
  y: number;
  selected?: boolean;
  opacity?: number;
  visible?: boolean;
  draggable?: boolean;
  onNodeClick?: (id: string, ctrlKey: boolean) => void;
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, nodeId: string) => void;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
  onMouseEnter?: (e: KonvaEventObject<MouseEvent>, id: string) => void;
  onMouseLeave?: (e: KonvaEventObject<MouseEvent>, id: string) => void;
  /**
   * Final size on release. Transformer-based containers (system boundary, UC
   * module, package) also report `dx`/`dy`: dragging a left/top anchor moves the
   * node's origin, and that shift has to be persisted alongside the new size.
   */
  onResizeEnd?: (id: string, width: number, height: number, dx?: number, dy?: number) => void;
  /** Clears a lifeline's manual timeline length (G-c foot-handle double-click). */
  onResetTimeline?: (id: string) => void;
  isDropTarget?: boolean;
}

/**
 * Size of a node on the canvas, from the kind's descriptor (ADR-0009).
 *
 * Kinds that opt out of the ShapeRouter path — the package — and view models
 * that resolve to no kind at all fall back to the class box, which is the
 * behaviour this function has always had.
 */
export function getShapeSize(vm: AnyNodeViewModel): { width: number; height: number } {
  const kind = getNodeKind(vm);
  const size = kind ? NODE_KIND_DESCRIPTORS[kind]?.size : null;
  if (!size) return getClassShapeSize(vm as NodeViewModel);
  return (size as (v: AnyNodeViewModel) => { width: number; height: number })(vm);
}

/**
 * Renders a node through its kind's descriptor (ADR-0009).
 *
 * The optional props are peeled off once here and handed on as `common`; each
 * descriptor entry opts back into the ones its shape declares. Kinds with no
 * renderer — the package, which draws in its own layer — and unresolved view
 * models fall back to the class box, as before.
 */
export function renderShape(vm: AnyNodeViewModel, props: NodeShapeRenderProps): React.ReactNode {
  const { key, onMouseEnter, onMouseLeave, onResizeEnd, onResetTimeline, isDropTarget, ...common } = props;

  const kind = getNodeKind(vm);
  const render = kind ? NODE_KIND_DESCRIPTORS[kind]?.render : null;
  if (!render) return <ClassShape key={key} viewModel={vm as NodeViewModel} {...common} />;

  return (render as (v: AnyNodeViewModel, a: NodeRenderArgs) => React.ReactNode)(vm, {
    key,
    common,
    onMouseEnter,
    onMouseLeave,
    onResizeEnd,
    onResetTimeline,
    isDropTarget,
  });
}
