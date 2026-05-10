import type React from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import type {
  AnyNodeViewModel,
  NodeViewModel,
} from '../adapters/react-flow/view-models/node.view-model';
import {
  isNoteViewModel,
  isActorViewModel,
  isUseCaseViewModel,
  isSystemBoundaryViewModel,
  isDomainEntityViewModel,
} from '../adapters/react-flow/view-models/node.view-model';
import ClassShape, { getClassShapeSize } from './shapes/ClassShape';
import NoteShape, { getNoteShapeSize } from './shapes/NoteShape';
import ActorShape, { getActorShapeSize } from './shapes/ActorShape';
import UseCaseShape, { getUseCaseShapeSize } from './shapes/UseCaseShape';
import SystemBoundaryShape, { getSystemBoundaryShapeSize } from './shapes/SystemBoundaryShape';
import DomainEntityShape, { getDomainEntityShapeSize } from './shapes/DomainEntityShape';

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
  onMouseEnter?: (e: KonvaEventObject<MouseEvent>, id: string) => void;
  onMouseLeave?: (e: KonvaEventObject<MouseEvent>, id: string) => void;
  onResizeEnd?: (id: string, width: number, height: number) => void;
  isDropTarget?: boolean;
}

export function getShapeSize(vm: AnyNodeViewModel): { width: number; height: number } {
  if (isNoteViewModel(vm))           return getNoteShapeSize(vm);
  if (isActorViewModel(vm))          return getActorShapeSize(vm);
  if (isUseCaseViewModel(vm))        return getUseCaseShapeSize(vm);
  if (isSystemBoundaryViewModel(vm)) return getSystemBoundaryShapeSize(vm);
  if (isDomainEntityViewModel(vm))   return getDomainEntityShapeSize(vm);
  return getClassShapeSize(vm as NodeViewModel);
}

export function renderShape(vm: AnyNodeViewModel, props: NodeShapeRenderProps): React.ReactNode {
  const { key, onMouseEnter, onMouseLeave, onResizeEnd, isDropTarget, ...common } = props;

  if (isNoteViewModel(vm))
    return <NoteShape key={key} viewModel={vm} {...common} />;

  if (isActorViewModel(vm))
    return <ActorShape key={key} viewModel={vm} {...common} />;

  if (isUseCaseViewModel(vm))
    return (
      <UseCaseShape
        key={key} viewModel={vm} {...common}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );

  if (isSystemBoundaryViewModel(vm))
    return (
      <SystemBoundaryShape
        key={key} viewModel={vm} {...common}
        onResizeEnd={onResizeEnd}
        isDropTarget={isDropTarget}
      />
    );

  if (isDomainEntityViewModel(vm))
    return <DomainEntityShape key={key} viewModel={vm} {...common} />;

  return <ClassShape key={key} viewModel={vm as NodeViewModel} {...common} />;
}
