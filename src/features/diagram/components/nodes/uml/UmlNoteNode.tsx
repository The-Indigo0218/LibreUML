import { memo, useState, useEffect, useRef, useCallback } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NoteViewModel } from "../../../../../adapters/react-flow/view-models/node.view-model";
import { useProjectStore } from "../../../../../store/project.store";
import { handleConfig } from "../../../../../config/theme.config";

/**
 * UmlNoteNode — inline-editable sticky note on the canvas.
 *
 * Editing model:
 *  - Double-click content area  → enter content edit mode
 *  - Double-click title bar     → enter title edit mode
 *  - Blur / Enter               → commit and exit edit mode
 *  - Escape                     → discard and exit edit mode
 *
 * Event propagation:
 *  All pointer/mouse events inside the editable areas call stopPropagation()
 *  while editing is active so React Flow never starts a drag or clears
 *  selection mid-type.
 *
 * Persistence (two paths):
 *  1. VFS mode  → viewModel.onSave() callback provided by useVFSCanvasController
 *  2. Legacy    → projectStore.updateNode() (same pattern as UmlClassNode)
 *
 * Local buffering:
 *  Content is buffered in local state and flushed to the store only on blur
 *  (not on every keystroke). This avoids triggering a Zustand re-render per
 *  character, which previously caused cursor-jump issues in the controlled textarea.
 */
const UmlNoteNode = ({ data, selected }: NodeProps<NoteViewModel>) => {
  const { t } = useTranslation();
  const updateNode = useProjectStore((s) => s.updateNode);
  const viewModel = data;

  // ── Edit mode flags ──────────────────────────────────────────────────────
  const [editingContent, setEditingContent] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);

  // ── Local buffers (uncontrolled from store, flushed on blur) ─────────────
  const [localContent, setLocalContent] = useState(viewModel.content);
  const [localTitle, setLocalTitle] = useState(viewModel.title ?? "");

  // Keep local buffers in sync when external state changes (but not while typing)
  useEffect(() => {
    if (!editingContent) setLocalContent(viewModel.content);
  }, [viewModel.content, editingContent]);

  useEffect(() => {
    if (!editingTitle) setLocalTitle(viewModel.title ?? "");
  }, [viewModel.title, editingTitle]);

  // ── Refs for focus management ─────────────────────────────────────────────
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // ── Persistence helper ───────────────────────────────────────────────────
  const persist = useCallback(
    (update: { content?: string; title?: string }) => {
      if (viewModel.onSave) {
        // VFS path: callback provided by useVFSCanvasController
        viewModel.onSave(update);
      } else {
        // Legacy path: direct ProjectStore update (same pattern as UmlClassNode)
        if (update.content !== undefined) {
          updateNode(viewModel.domainId, { content: update.content } as never);
        }
        if (update.title !== undefined) {
          updateNode(viewModel.domainId, { name: update.title } as never);
        }
      }
    },
    [viewModel, updateNode],
  );

  // ── Content handlers ──────────────────────────────────────────────────────
  const commitContent = useCallback(() => {
    setEditingContent(false);
    persist({ content: localContent });
  }, [localContent, persist]);

  const cancelContent = useCallback(() => {
    setLocalContent(viewModel.content);
    setEditingContent(false);
  }, [viewModel.content]);

  // ── Title handlers ────────────────────────────────────────────────────────
  const commitTitle = useCallback(() => {
    setEditingTitle(false);
    persist({ title: localTitle });
  }, [localTitle, persist]);

  const cancelTitle = useCallback(() => {
    setLocalTitle(viewModel.title ?? "");
    setEditingTitle(false);
  }, [viewModel.title]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const handleStyle = `${handleConfig.size} ${handleConfig.base} ${handleConfig.colors.note} opacity-0 group-hover:opacity-100`;

  const selectionClasses = selected
    ? "ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] !border-cyan-500 z-10"
    : "border-uml-note-border hover:shadow-md";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`bg-uml-note-bg border rounded-sm w-56 overflow-hidden relative group flex flex-col font-sans transition-all duration-200 ${selectionClasses}`}
    >
      <Handle type="source" position={Position.Top}    id="top"    className={handleStyle} />
      <Handle type="source" position={Position.Right}  id="right"  className={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleStyle} />
      <Handle type="source" position={Position.Left}   id="left"   className={handleStyle} />

      {/* ── Title bar ─────────────────────────────────────────────────── */}
      {viewModel.title !== undefined && (
        <div
          className="bg-surface-secondary p-2 border-b border-dashed border-uml-note-border rounded-t-sm flex items-center justify-between"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingTitle(true);
            // Next tick so the input has rendered before we focus it
            setTimeout(() => titleRef.current?.select(), 0);
          }}
        >
          {editingTitle ? (
            <input
              ref={titleRef}
              autoFocus
              className="w-full bg-transparent font-bold text-sm text-uml-note-border outline-none placeholder-uml-note-border/50"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") cancelTitle();
              }}
              // ── Critical: stop RF drag/selection events ──────────────
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Title..."
            />
          ) : (
            <div className="font-bold text-sm text-uml-note-border truncate w-full pr-4 select-none">
              {localTitle || <span className="opacity-40 font-normal italic">{t('noteNode.titlePlaceholder')}</span>}
            </div>
          )}

          {!editingTitle && (
            <StickyNote className="w-3 h-3 text-uml-note-border shrink-0" />
          )}
        </div>
      )}

      {/* ── Content area ──────────────────────────────────────────────── */}
      <div
        className="p-2 min-h-20 max-h-40 overflow-y-auto"
        // Double-click enters edit mode — single click is consumed by RF for selection
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditingContent(true);
          setTimeout(() => contentRef.current?.focus(), 0);
        }}
        // When already editing, stop RF from stealing pointer-down
        onPointerDown={(e) => {
          if (editingContent) e.stopPropagation();
        }}
      >
        {editingContent ? (
          <textarea
            ref={contentRef}
            autoFocus
            className="w-full min-h-20 bg-transparent resize-none outline-none text-xs text-text-secondary leading-relaxed font-mono cursor-text overflow-hidden [overflow-wrap:anywhere]"
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            onBlur={commitContent}
            onKeyDown={(e) => {
              // Propagation must be stopped so Delete/Backspace etc. don't
              // trigger canvas-level keyboard shortcuts (node deletion, etc.)
              e.stopPropagation();
              if (e.key === "Escape") cancelContent();
            }}
            // ── Critical: stop RF drag/selection events ────────────────
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Double-click to add note text..."
          />
        ) : (
          <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] min-w-0 font-mono select-none cursor-default">
            {localContent || (
              <span className="opacity-30 italic">{t('noteNode.contentPlaceholder')}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(UmlNoteNode);
