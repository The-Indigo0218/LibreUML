/**
 * InlineEditor — HTML input overlay for inline text editing (MAG-01.10)
 *
 * Architecture:
 * - Renders as HTML <input> positioned via CSS absolute over canvas
 * - Position calculated in screen-space coordinates (not canvas coordinates)
 * - Activated by double-clicking ClassShape/NoteShape
 * - Commits on Enter, blur; cancels on Escape
 * - Generics parsing handled by inlineEditorStore.commitEdit()
 *
 * CSS positioning:
 * - position: absolute (relative to CanvasOverlay parent)
 * - left/top: screen-space coordinates from Konva transform
 * - width/height: matches text dimensions for seamless overlay
 * - z-index: 20 (above canvas, below modals)
 * - pointer-events: auto (captures clicks, rest of overlay is passthrough)
 *
 * Viewport tracking:
 * - Position updates when stage transform changes (pan/zoom)
 * - Handled by parent component (KonvaCanvas) via updatePosition()
 *
 * Integration:
 * - ClassShape onDblClick → startEditing() with screen coords
 * - NoteShape onDblClick → startEditing() with screen coords
 * - Commit callback writes to ModelStore (same path as UmlClassNode)
 */

import { useEffect, useRef } from 'react';
import { useInlineEditorStore } from '../store/inlineEditorStore';

export default function InlineEditor() {
  const {
    isEditing,
    currentText,
    position,
    dimensions,
    updateText,
    commitEdit,
    cancelEdit,
  } = useInlineEditorStore();

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when editor opens
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select(); // Select all text for easy replacement
    }
  }, [isEditing]);

  if (!isEditing || !position || !dimensions) {
    return null;
  }

  return (
    <input
      ref={inputRef}
      type="text"
      className="absolute z-20 bg-white/95 border-2 border-blue-500/70 rounded
                 outline-none text-sm text-center font-sans font-bold
                 text-gray-900 shadow-lg backdrop-blur-sm
                 pointer-events-auto transition-colors
                 focus:border-blue-600 focus:bg-white"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
      value={currentText}
      onChange={(e) => updateText(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitEdit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelEdit();
        }
      }}
    />
  );
}
