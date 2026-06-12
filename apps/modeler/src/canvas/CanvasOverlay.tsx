import InlineEditor from './overlays/InlineEditor';
import SelectionToolbar from './overlays/SelectionToolbar';
import type { ToolbarAction } from './overlays/SelectionToolbar';
import InlineEdgePanel from './overlays/InlineEdgePanel';
import type { InlineEdgePanelProps } from './overlays/InlineEdgePanel';
import InlineClassPanel from './overlays/InlineClassPanel';
import type { InlineClassPanelProps } from './overlays/InlineClassPanel';
import InlineUseCasePanel from './overlays/InlineUseCasePanel';
import type { InlineUseCasePanelProps } from './overlays/InlineUseCasePanel';
import InlineDomainPanel from './overlays/InlineDomainPanel';
import type { InlineDomainPanelProps } from './overlays/InlineDomainPanel';
import InlineActorPanel from './overlays/InlineActorPanel';
import type { InlineActorPanelProps } from './overlays/InlineActorPanel';
import InlineMessagePanel from './overlays/InlineMessagePanel';
import type { InlineMessagePanelProps } from './overlays/InlineMessagePanel';
import InlineFragmentPanel from './overlays/InlineFragmentPanel';
import type { InlineFragmentPanelProps } from './overlays/InlineFragmentPanel';
import InlineStateInvariantPanel from './overlays/InlineStateInvariantPanel';
import type { InlineStateInvariantPanelProps } from './overlays/InlineStateInvariantPanel';
import InlineInteractionUsePanel from './overlays/InlineInteractionUsePanel';
import type { InlineInteractionUsePanelProps } from './overlays/InlineInteractionUsePanel';
import InlineGatePanel from './overlays/InlineGatePanel';
import type { InlineGatePanelProps } from './overlays/InlineGatePanel';
import RelationPickerMenu from './overlays/RelationPickerMenu';
import NodeTypePickerMenu from './overlays/NodeTypePickerMenu';
import type { UmlRelationType, stereotype } from '../features/diagram/types/diagram.types';
import ContextMenu from '../features/diagram/components/ui/ContextMenu';

interface CanvasOverlayProps {
  contextMenu: {
    type: 'node' | 'edge' | 'pane';
    x: number;
    y: number;
    id?: string;
  } | null;
  contextMenuOptions: { label: string; onClick: () => void; danger?: boolean; icon?: string }[];
  onCloseContextMenu: () => void;
  selectionToolbar?: { x: number; y: number; actions: ToolbarAction[] } | null;
  inlineEdgePanel?: InlineEdgePanelProps | null;
  inlineClassPanel?: InlineClassPanelProps | null;
  inlineUseCasePanel?: InlineUseCasePanelProps | null;
  inlineDomainPanel?: InlineDomainPanelProps | null;
  inlineActorPanel?: InlineActorPanelProps | null;
  inlineMessagePanel?: InlineMessagePanelProps | null;
  inlineFragmentPanel?: InlineFragmentPanelProps | null;
  inlineStateInvariantPanel?: InlineStateInvariantPanelProps | null;
  inlineInteractionUsePanel?: InlineInteractionUsePanelProps | null;
  inlineGatePanel?: InlineGatePanelProps | null;
  relationPicker?: {
    x: number;
    y: number;
    types: UmlRelationType[];
    onPick: (type: UmlRelationType) => void;
    onClose: () => void;
  } | null;
  nodeTypePicker?: {
    x: number;
    y: number;
    types: stereotype[];
    onPick: (type: stereotype) => void;
    onClose: () => void;
  } | null;
}

export default function CanvasOverlay({
  contextMenu,
  contextMenuOptions,
  onCloseContextMenu,
  selectionToolbar,
  inlineEdgePanel,
  inlineClassPanel,
  inlineUseCasePanel,
  inlineDomainPanel,
  inlineActorPanel,
  inlineMessagePanel,
  inlineFragmentPanel,
  inlineStateInvariantPanel,
  inlineInteractionUsePanel,
  inlineGatePanel,
  relationPicker,
  nodeTypePicker,
}: CanvasOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-10 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    >
      <InlineEditor />

      {selectionToolbar && (
        <SelectionToolbar
          x={selectionToolbar.x}
          y={selectionToolbar.y}
          actions={selectionToolbar.actions}
        />
      )}

      {inlineEdgePanel && (
        <InlineEdgePanel
          key={[
            inlineEdgePanel.edgeId,
            inlineEdgePanel.values.sourceMultiplicity,
            inlineEdgePanel.values.targetMultiplicity,
            inlineEdgePanel.values.sourceRole,
            inlineEdgePanel.values.targetRole,
          ].join(' ')}
          {...inlineEdgePanel}
        />
      )}

      {inlineClassPanel && <InlineClassPanel key={inlineClassPanel.elementId} {...inlineClassPanel} />}

      {inlineUseCasePanel && <InlineUseCasePanel key={inlineUseCasePanel.elementId} {...inlineUseCasePanel} />}

      {inlineDomainPanel && <InlineDomainPanel key={inlineDomainPanel.elementId} {...inlineDomainPanel} />}

      {inlineActorPanel && <InlineActorPanel key={inlineActorPanel.elementId} {...inlineActorPanel} />}

      {inlineMessagePanel && <InlineMessagePanel key={inlineMessagePanel.elementId} {...inlineMessagePanel} />}

      {inlineFragmentPanel && <InlineFragmentPanel key={inlineFragmentPanel.elementId} {...inlineFragmentPanel} />}

      {inlineStateInvariantPanel && <InlineStateInvariantPanel key={inlineStateInvariantPanel.elementId} {...inlineStateInvariantPanel} />}

      {inlineInteractionUsePanel && <InlineInteractionUsePanel key={inlineInteractionUsePanel.elementId} {...inlineInteractionUsePanel} />}

      {inlineGatePanel && <InlineGatePanel key={inlineGatePanel.elementId} {...inlineGatePanel} />}

      {relationPicker && (
        <RelationPickerMenu
          x={relationPicker.x}
          y={relationPicker.y}
          types={relationPicker.types}
          onPick={relationPicker.onPick}
          onClose={relationPicker.onClose}
        />
      )}

      {nodeTypePicker && (
        <NodeTypePickerMenu
          x={nodeTypePicker.x}
          y={nodeTypePicker.y}
          types={nodeTypePicker.types}
          onPick={nodeTypePicker.onPick}
          onClose={nodeTypePicker.onClose}
        />
      )}

      {contextMenu && (
        <div className="pointer-events-auto">
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            options={contextMenuOptions}
            onClose={onCloseContextMenu}
            centered={true}
          />
        </div>
      )}
    </div>
  );
}
