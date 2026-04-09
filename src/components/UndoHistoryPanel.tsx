import { History } from 'lucide-react';
import { useWorkspaceStore } from '../store/workspace.store';
import { useUndoManager } from '../core/undo/useUndoManager';
import { undoManager } from '../core/undo/instance';

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function UndoHistoryPanel() {
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const { undoStack, redoStack } = useUndoManager(undoManager, activeTabId ?? undefined);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-surface-border shrink-0 flex items-center gap-2 select-none">
        <History className="w-4 h-4 text-text-muted" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          History
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto py-1 text-xs">
        {undoStack.length === 0 && redoStack.length === 0 ? (
          <p className="text-[11px] text-text-muted/40 italic px-4 py-3 text-center">
            No history yet
          </p>
        ) : (
          <>
            {undoStack.length > 0 && (
              <div>
                {[...undoStack].reverse().map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-3 py-1 hover:bg-surface-hover"
                    title={entry.label}
                  >
                    <span className="text-[11px] text-text-primary truncate flex-1 mr-2">
                      {entry.label}
                    </span>
                    <span className="text-[10px] text-text-muted/50 shrink-0 tabular-nums">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 my-0.5">
              <div className="flex-1 h-px bg-surface-border" />
              <span className="text-[10px] text-text-muted/40 font-medium shrink-0">
                Current
              </span>
              <div className="flex-1 h-px bg-surface-border" />
            </div>

            {redoStack.length > 0 && (
              <div className="opacity-40">
                {redoStack.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-3 py-1"
                    title={entry.label}
                  >
                    <span className="text-[11px] text-text-primary truncate flex-1 mr-2">
                      {entry.label}
                    </span>
                    <span className="text-[10px] text-text-muted/50 shrink-0 tabular-nums">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
