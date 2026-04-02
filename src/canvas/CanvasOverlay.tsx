/**
 * CanvasOverlay — HTML overlay layer (Layer 0) for canvas UI (MAG-01.10, MAG-01.12)
 *
 * Architecture:
 * - Positioned absolutely above Konva Stage via CSS
 * - pointer-events: none (passthrough to canvas by default)
 * - Individual children opt into pointer-events: auto when active
 * - Z-index: 10 (above canvas, below modals)
 *
 * Why HTML overlay?
 * - Context menus need native HTML: keyboard nav, accessibility, styled dropdowns
 * - Inline editor needs <input>: text selection, IME support, clipboard
 * - Tooltips need CSS transitions, shadows, rich formatting
 * - Canvas can't provide native browser behavior for these UI elements
 *
 * Event flow:
 * - User click → hits overlay? (pointer-events: none → passes through)
 * - → hits Konva Stage → Konva event bubbling → handler hooks
 * - OR hits active overlay child (pointer-events: auto) → React event
 *
 * Children:
 * - <InlineEditor /> (MAG-01.10) — text input for node names
 * - <ContextMenu /> (MAG-01.12) — right-click menu
 * - <EdgeTooltip /> (MAG-01.12) — hover tooltip for edge kind
 *
 * Future:
 * - <ConnectionLabels /> — multiplicity/role labels
 * - <MiniMap /> — could be Konva or HTML
 *
 * Integration:
 * - Rendered in KonvaCanvas above Stage
 * - Fills parent container (w-full h-full)
 * - Children positioned via absolute coordinates
 */

import InlineEditor from './overlays/InlineEditor';
import ContextMenu from '../features/diagram/components/ui/ContextMenu';

interface CanvasOverlayProps {
  /** Context menu state (null = closed) */
  contextMenu: {
    type: 'node' | 'edge' | 'pane';
    x: number;
    y: number;
    id?: string;
  } | null;
  /** Context menu options */
  contextMenuOptions: { label: string; onClick: () => void; danger?: boolean; icon?: string }[];
  /** Close context menu callback */
  onCloseContextMenu: () => void;
}

export default function CanvasOverlay({
  contextMenu,
  contextMenuOptions,
  onCloseContextMenu,
}: CanvasOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-10 pointer-events-none"
      style={{
        // Ensure overlay fills the canvas container
        width: '100%',
        height: '100%',
      }}
    >
      {/* Inline text editor (MAG-01.10) */}
      <InlineEditor />

      {/* Context menu (MAG-01.12) — pointer-events: auto when visible */}
      {contextMenu && (
        <div className="pointer-events-auto">
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            options={contextMenuOptions}
            onClose={onCloseContextMenu}
            centered={contextMenu.type === 'node'}
          />
        </div>
      )}

      {/* Edge badge tooltip is rendered inline on the Konva canvas via KonvaEdge */}
    </div>
  );
}
