import type React from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import type {
  AnyNodeViewModel,
  NodeViewModel,
} from '../adapters/view-models/node.view-model';
import {
  isNoteViewModel,
  isActorViewModel,
  isUseCaseViewModel,
  isSystemBoundaryViewModel,
  isUCModuleViewModel,
  isDomainEntityViewModel,
  isLifelineViewModel,
  isMessageViewModel,
  isActivationViewModel,
  isFragmentViewModel,
  isStateInvariantViewModel,
  isInteractionUseViewModel,
  isGateViewModel,
  isGeneralOrderingViewModel,
  isTimeConstraintViewModel,
  isCoregionViewModel,
  isContinuationViewModel,
} from '../adapters/view-models/node.view-model';
import ClassShape, { getClassShapeSize } from './shapes/ClassShape';
import NoteShape, { getNoteShapeSize } from './shapes/NoteShape';
import ActorShape, { getActorShapeSize } from './shapes/ActorShape';
import UseCaseShape, { getUseCaseShapeSize } from './shapes/UseCaseShape';
import SystemBoundaryShape, { getSystemBoundaryShapeSize } from './shapes/SystemBoundaryShape';
import UCModuleShape, { getUCModuleShapeSize } from './shapes/UCModuleShape';
import DomainEntityShape, { getDomainEntityShapeSize } from './shapes/DomainEntityShape';
import LifelineShape, { getLifelineShapeSize } from './shapes/LifelineShape';
import MessageShape, { getMessageShapeSize } from './shapes/MessageShape';
import ActivationShape, { getActivationShapeSize } from './shapes/ActivationShape';
import FragmentShape, { getFragmentShapeSize } from './shapes/FragmentShape';
import StateInvariantShape, { getStateInvariantShapeSize } from './shapes/StateInvariantShape';
import InteractionUseShape, { getInteractionUseShapeSize } from './shapes/InteractionUseShape';
import GateShape, { getGateShapeSize } from './shapes/GateShape';
import GeneralOrderingShape, { getGeneralOrderingShapeSize } from './shapes/GeneralOrderingShape';
import TimeConstraintShape, { getTimeConstraintShapeSize } from './shapes/TimeConstraintShape';
import CoregionShape, { getCoregionShapeSize } from './shapes/CoregionShape';
import ContinuationShape, { getContinuationShapeSize } from './shapes/ContinuationShape';

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

export function getShapeSize(vm: AnyNodeViewModel): { width: number; height: number } {
  if (isNoteViewModel(vm))           return getNoteShapeSize(vm);
  if (isActorViewModel(vm))          return getActorShapeSize(vm);
  if (isUseCaseViewModel(vm))        return getUseCaseShapeSize(vm);
  if (isSystemBoundaryViewModel(vm)) return getSystemBoundaryShapeSize(vm);
  if (isUCModuleViewModel(vm))       return getUCModuleShapeSize(vm);
  if (isDomainEntityViewModel(vm))   return getDomainEntityShapeSize(vm);
  if (isLifelineViewModel(vm))       return getLifelineShapeSize(vm);
  if (isMessageViewModel(vm))        return getMessageShapeSize(vm);
  if (isActivationViewModel(vm))     return getActivationShapeSize(vm);
  if (isFragmentViewModel(vm))       return getFragmentShapeSize(vm);
  if (isStateInvariantViewModel(vm)) return getStateInvariantShapeSize(vm);
  if (isInteractionUseViewModel(vm)) return getInteractionUseShapeSize(vm);
  if (isGateViewModel(vm))           return getGateShapeSize(vm);
  if (isGeneralOrderingViewModel(vm)) return getGeneralOrderingShapeSize(vm);
  if (isTimeConstraintViewModel(vm)) return getTimeConstraintShapeSize(vm);
  if (isCoregionViewModel(vm))       return getCoregionShapeSize(vm);
  if (isContinuationViewModel(vm))   return getContinuationShapeSize(vm);
  return getClassShapeSize(vm as NodeViewModel);
}

export function renderShape(vm: AnyNodeViewModel, props: NodeShapeRenderProps): React.ReactNode {
  const { key, onMouseEnter, onMouseLeave, onResizeEnd, onResetTimeline, isDropTarget, ...common } = props;

  if (isNoteViewModel(vm))
    return <NoteShape key={key} viewModel={vm} {...common} onResizeEnd={onResizeEnd} />;

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

  if (isUCModuleViewModel(vm))
    return (
      <UCModuleShape
        key={key} viewModel={vm} {...common}
        onResizeEnd={onResizeEnd}
        isDropTarget={isDropTarget}
      />
    );

  if (isDomainEntityViewModel(vm))
    return <DomainEntityShape key={key} viewModel={vm} {...common} />;

  if (isLifelineViewModel(vm))
    return (
      <LifelineShape
        key={key} viewModel={vm} {...common}
        onResizeEnd={onResizeEnd}
        onResetTimeline={onResetTimeline}
      />
    );

  if (isMessageViewModel(vm))
    return <MessageShape key={key} viewModel={vm} {...common} />;

  if (isActivationViewModel(vm))
    // Activations are system-managed (no drag/resize): pass only the props the
    // lean shape uses rather than the full draggable `common` bundle.
    return (
      <ActivationShape
        key={key}
        viewModel={vm}
        x={common.x}
        y={common.y}
        selected={common.selected}
        opacity={common.opacity}
        visible={common.visible}
        onNodeClick={common.onNodeClick}
        onContextMenu={common.onContextMenu}
      />
    );

  if (isFragmentViewModel(vm))
    return <FragmentShape key={key} viewModel={vm} {...common} onResizeEnd={onResizeEnd} />;

  if (isStateInvariantViewModel(vm))
    return <StateInvariantShape key={key} viewModel={vm} {...common} onResizeEnd={onResizeEnd} />;

  if (isInteractionUseViewModel(vm))
    return <InteractionUseShape key={key} viewModel={vm} {...common} onResizeEnd={onResizeEnd} />;

  if (isGateViewModel(vm))
    return <GateShape key={key} viewModel={vm} {...common} />;

  if (isGeneralOrderingViewModel(vm))
    return <GeneralOrderingShape key={key} viewModel={vm} {...common} />;

  if (isTimeConstraintViewModel(vm))
    return <TimeConstraintShape key={key} viewModel={vm} {...common} />;

  if (isCoregionViewModel(vm))
    return <CoregionShape key={key} viewModel={vm} {...common} />;

  if (isContinuationViewModel(vm))
    return <ContinuationShape key={key} viewModel={vm} {...common} />;

  return <ClassShape key={key} viewModel={vm as NodeViewModel} {...common} />;
}
