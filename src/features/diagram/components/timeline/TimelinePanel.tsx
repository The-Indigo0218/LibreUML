import { Clock, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { useFileHistory } from "../../hooks/actions/useFileHistory";
import { useTranslation } from "react-i18next";

/**
 * Timeline Panel Component
 * 
 * PHASE 9.7.1: Upgraded to use per-file history system
 * 
 * VS Code-style timeline UI for viewing and navigating history.
 * Displays past and future states with timestamps and allows
 * jumping to any specific point in time.
 * 
 * Features:
 * - Visual timeline of changes per file
 * - Current state indicator
 * - Click any state to jump to it
 * - Undo/Redo buttons
 * - Clear history button
 * - Timestamp and change count display
 * 
 * Architecture:
 * - Reads from per-file history (useFileHistory)
 * - Each file has independent timeline
 * - Supports jumping to any past or future state
 */
export function TimelinePanel() {
  const { t } = useTranslation();
  
  const {
    undo,
    redo,
    clearHistory,
    canUndo,
    canRedo,
    historyStats,
    jumpToPast,
    jumpToFuture,
    getFormattedHistory,
  } = useFileHistory();

  const { past, future } = getFormattedHistory();

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getChangeDescription = (nodeCount: number, edgeCount: number) => {
    return `${nodeCount} ${nodeCount === 1 ? t('timeline.node') : t('timeline.nodes')}, ${edgeCount} ${edgeCount === 1 ? t('timeline.edge') : t('timeline.edges')}`;
  };

  return (
    <div className="flex flex-col h-full bg-surface-primary border-t border-surface-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium text-text-primary">{t('timeline.title')}</span>
          <span className="text-xs text-text-muted">
            ({historyStats.pastCount} {t('timeline.past')}, {historyStats.futureCount} {t('timeline.future')})
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={t('timeline.undo')}
          >
            <RotateCcw className="w-4 h-4 text-text-secondary" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={t('timeline.redo')}
          >
            <RotateCw className="w-4 h-4 text-text-secondary" />
          </button>
          <button
            onClick={clearHistory}
            disabled={historyStats.totalSteps === 0}
            className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={t('timeline.clearHistory')}
          >
            <Trash2 className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto">
        {historyStats.totalSteps === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted px-4 text-center">
            <Clock className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">{t('timeline.noHistory')}</p>
            <p className="text-xs mt-1">{t('timeline.noHistoryHint')}</p>
          </div>
        ) : (
          <div className="py-2">
            {/* Future States (in reverse order - newest first) */}
            {future.length > 0 && (
              <div className="mb-2">
                {[...future].reverse().map((state, reverseIndex) => {
                  const actualIndex = future.length - 1 - reverseIndex;
                  return (
                    <div
                      key={`future-${actualIndex}`}
                      className="px-3 py-2 hover:bg-surface-hover cursor-pointer transition-colors opacity-60 hover:opacity-100"
                      onClick={() => jumpToFuture(actualIndex)}
                      title={t('timeline.jumpToFuture')}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text-secondary font-medium">
                            {t('timeline.savedState')}
                          </div>
                          <div className="text-xs text-text-muted">
                            {formatTime(state.timestamp)}
                          </div>
                          <div className="text-xs text-text-muted truncate">
                            {getChangeDescription(state.nodeCount, state.edgeCount)}
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
                    {t('timeline.currentState')}
                  </div>
                  <div className="text-xs text-text-muted">
                    {formatTime(Date.now())}
                  </div>
                </div>
              </div>
            </div>

            {/* Past States (in reverse order - newest first) */}
            {past.length > 0 && (
              <div className="mt-2">
                {[...past].reverse().map((state, reverseIndex) => {
                  const actualIndex = past.length - 1 - reverseIndex;
                  return (
                    <div
                      key={`past-${actualIndex}`}
                      className="px-3 py-2 hover:bg-surface-hover cursor-pointer transition-colors"
                      onClick={() => jumpToPast(actualIndex)}
                      title={t('timeline.jumpToPast')}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text-secondary font-medium">
                            {t('timeline.savedState')}
                          </div>
                          <div className="text-xs text-text-muted">
                            {formatTime(state.timestamp)}
                          </div>
                          <div className="text-xs text-text-muted truncate">
                            {getChangeDescription(state.nodeCount, state.edgeCount)}
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
              {historyStats.totalSteps} {historyStats.totalSteps === 1 ? t('timeline.step') : t('timeline.steps')} {t('timeline.inHistory')}
              {historyStats.totalSteps >= 50 && ` (${t('timeline.limitReached')})`}
            </>
          ) : (
            t('timeline.shortcuts')
          )}
        </div>
      </div>
    </div>
  );
}
