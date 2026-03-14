import { Clock, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { useHistoryActions } from "../../hooks/actions/useHistoryActions";

/**
 * Timeline Panel Component
 * 
 * VS Code-style timeline UI for viewing and navigating history.
 * Displays past and future states with timestamps.
 * 
 * Features:
 * - Visual timeline of changes
 * - Current state indicator
 * - Undo/Redo buttons
 * - Clear history button
 * - Timestamp display
 * 
 * Architecture:
 * - Reads from zundo temporal store
 * - Displays past and future states
 * - Allows navigation through history
 */
export function TimelinePanel() {
  const {
    undo,
    redo,
    clearHistory,
    canUndo,
    canRedo,
    historyStats,
    pastStates,
    futureStates,
  } = useHistoryActions();

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getChangeDescription = (state: any) => {
    // Generate a simple description based on state changes
    const nodeCount = Object.keys(state.nodes || {}).length;
    const edgeCount = Object.keys(state.edges || {}).length;
    return `${nodeCount} nodes, ${edgeCount} edges`;
  };

  return (
    <div className="flex flex-col h-full bg-surface-primary border-t border-surface-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium text-text-primary">Timeline</span>
          <span className="text-xs text-text-muted">
            ({historyStats.pastCount} past, {historyStats.futureCount} future)
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-4 h-4 text-text-secondary" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <RotateCw className="w-4 h-4 text-text-secondary" />
          </button>
          <button
            onClick={clearHistory}
            disabled={historyStats.totalSteps === 0}
            className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Clear History"
          >
            <Trash2 className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto">
        {historyStats.totalSteps === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Clock className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No history yet</p>
            <p className="text-xs mt-1">Make changes to see timeline</p>
          </div>
        ) : (
          <div className="py-2">
            {/* Future States (in reverse order) */}
            {futureStates.length > 0 && (
              <div className="mb-2">
                {[...futureStates].reverse().map((state, index) => {
                  const actualIndex = futureStates.length - 1 - index;
                  return (
                    <div
                      key={`future-${actualIndex}`}
                      className="px-3 py-2 hover:bg-surface-hover cursor-pointer transition-colors opacity-50"
                      onClick={redo}
                      title="Click to redo"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text-secondary">
                            Future State {actualIndex + 1}
                          </div>
                          <div className="text-xs text-text-muted truncate">
                            {getChangeDescription(state)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Current State */}
            <div className="px-3 py-2 bg-cyan-500/10 border-l-2 border-cyan-500">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500 mt-1.5 flex-shrink-0 animate-pulse" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-cyan-400">
                    Current State
                  </div>
                  <div className="text-xs text-text-muted">
                    {formatTime(Date.now())}
                  </div>
                </div>
              </div>
            </div>

            {/* Past States */}
            {pastStates.length > 0 && (
              <div className="mt-2">
                {[...pastStates].reverse().map((state, index) => {
                  const actualIndex = pastStates.length - 1 - index;
                  return (
                    <div
                      key={`past-${actualIndex}`}
                      className="px-3 py-2 hover:bg-surface-hover cursor-pointer transition-colors"
                      onClick={undo}
                      title="Click to undo"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text-secondary">
                            Past State {actualIndex + 1}
                          </div>
                          <div className="text-xs text-text-muted truncate">
                            {getChangeDescription(state)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-surface-border bg-surface-secondary">
        <div className="text-xs text-text-muted">
          {historyStats.totalSteps > 0 ? (
            <>
              {historyStats.totalSteps} {historyStats.totalSteps === 1 ? 'step' : 'steps'} in history
              {historyStats.totalSteps >= 50 && ' (limit reached)'}
            </>
          ) : (
            'Use Ctrl+Z to undo, Ctrl+Y to redo'
          )}
        </div>
      </div>
    </div>
  );
}
