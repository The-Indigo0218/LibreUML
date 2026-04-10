import { create } from 'zustand';

/**
 * Inline Editor Store (MAG-01.10)
 *
 * Manages state for HTML input overlay positioned over canvas nodes.
 * Used for inline text editing of node names and note titles.
 *
 * Architecture:
 * - Store tracks editing state (isEditing, activeNodeId, currentText)
 * - Position stored in screen coordinates (CSS absolute positioning)
 * - Dimensions stored for input sizing (matches text width/height)
 * - Commit callback provided by activation (writes to ModelStore)
 *
 * Activation flow:
 * 1. User double-clicks ClassShape/NoteShape
 * 2. Shape calculates screen position via Konva transforms
 * 3. Shape calls startEditing(nodeId, text, field, pos, dims, callback)
 * 4. InlineEditor component renders HTML input at position
 * 5. User types, presses Enter → commitEdit() → callback(cleanText)
 * 6. Store resets, component unmounts
 *
 * Field types:
 * - 'name': Class/interface/enum name (supports generics parsing)
 * - 'title': Note title (plain text, no generics)
 */

export interface InlineEditorPosition {
  x: number; // Screen-space X (CSS left)
  y: number; // Screen-space Y (CSS top)
}

export interface InlineEditorDimensions {
  width: number;  // Input width (matches text width)
  height: number; // Input height (matches text height)
}

export type InlineEditorFieldType = 'name' | 'title';

interface InlineEditorState {
  /** Whether the editor is currently active */
  isEditing: boolean;

  /** ID of the node being edited (ViewNode.id or NoteViewModel.id) */
  activeNodeId: string | null;

  /** Current text value in the input */
  currentText: string;

  /** Field type being edited (determines parsing logic) */
  fieldType: InlineEditorFieldType;

  /** Screen-space position for CSS absolute positioning */
  position: InlineEditorPosition | null;

  /** Input dimensions (width/height in pixels) */
  dimensions: InlineEditorDimensions | null;

  /** Commit callback provided by the shape (writes to ModelStore) */
  onCommit: ((text: string, generics?: string) => void) | null;

  /**
   * Starts inline editing session.
   * Called by ClassShape/NoteShape on double-click.
   *
   * @param nodeId - ViewNode.id or NoteViewModel.id
   * @param text - Initial text value (current name/title)
   * @param fieldType - 'name' or 'title'
   * @param position - Screen-space {x, y} for CSS positioning
   * @param dimensions - Input {width, height} in pixels
   * @param onCommit - Callback to persist changes (writes to ModelStore)
   */
  startEditing: (
    nodeId: string,
    text: string,
    fieldType: InlineEditorFieldType,
    position: InlineEditorPosition,
    dimensions: InlineEditorDimensions,
    onCommit: (text: string, generics?: string) => void,
  ) => void;

  /**
   * Updates the current text value as user types.
   * Does not persist — only updates local state.
   */
  updateText: (text: string) => void;

  /**
   * Updates the screen position (called when viewport pans/zooms).
   * Keeps input aligned with node during viewport changes.
   */
  updatePosition: (position: InlineEditorPosition) => void;

  /**
   * Commits the edit and closes the editor.
   * Parses generics if fieldType === 'name', then calls onCommit callback.
   */
  commitEdit: () => void;

  /**
   * Cancels the edit and closes the editor.
   * Discards changes, does not call onCommit.
   */
  cancelEdit: () => void;
}

export const useInlineEditorStore = create<InlineEditorState>((set, get) => ({
  isEditing: false,
  activeNodeId: null,
  currentText: '',
  fieldType: 'name',
  position: null,
  dimensions: null,
  onCommit: null,

  startEditing: (nodeId, text, fieldType, position, dimensions, onCommit) => {
    set({
      isEditing: true,
      activeNodeId: nodeId,
      currentText: text,
      fieldType,
      position,
      dimensions,
      onCommit,
    });
  },

  updateText: (text) => {
    set({ currentText: text });
  },

  updatePosition: (position) => {
    set({ position });
  },

  commitEdit: () => {
    const { currentText, fieldType, onCommit } = get();
    if (!onCommit) {
      set({
        isEditing: false,
        activeNodeId: null,
        currentText: '',
        position: null,
        dimensions: null,
        onCommit: null,
      });
      return;
    }

    // Clean text: trim, collapse multiple spaces
    const cleaned = currentText.trim().replace(/\s+/g, ' ');

    if (fieldType === 'name') {
      // Parse generics: "ClassName<T>" → name="ClassName", generics="<T>"
      const match = cleaned.match(/^(.+?)(<.+>)$/);
      if (match) {
        const name = match[1].trim();
        const generics = match[2].trim();
        onCommit(name, generics);
      } else {
        onCommit(cleaned);
      }
    } else {
      // Plain text (note title)
      onCommit(cleaned);
    }

    // Reset state
    set({
      isEditing: false,
      activeNodeId: null,
      currentText: '',
      position: null,
      dimensions: null,
      onCommit: null,
    });
  },

  cancelEdit: () => {
    set({
      isEditing: false,
      activeNodeId: null,
      currentText: '',
      position: null,
      dimensions: null,
      onCommit: null,
    });
  },
}));
