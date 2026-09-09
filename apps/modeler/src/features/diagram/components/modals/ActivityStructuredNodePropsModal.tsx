import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUiStore } from '../../../../store/uiStore';
import { useModelStore } from '../../../../store/model.store';
import { useWorkspaceStore } from '../../../../store/workspace.store';
import { useVFSStore } from '../../../../store/project-vfs.store';
import { standaloneModelOps, getLocalModel } from '../../../../store/standaloneModelOps';
import type { IRActivityNode } from '../../../../core/domain/vfs/vfs.types';

const KIND_LABEL: Record<string, string> = {
  LOOP_NODE: 'Loop',
  CONDITIONAL_NODE: 'Conditional',
  EXPANSION_REGION: 'Expansion Region',
};

const EXPANSION_MODES = ['PARALLEL', 'ITERATIVE', 'STREAM'] as const;

/**
 * Structured node properties (v1.1) — sets `testExpression`, the free-text
 * stand-in for the real UML test/guard (loop condition, conditional clause),
 * for LOOP_NODE/CONDITIONAL_NODE; or `mode` (parallel/iterative/stream, a
 * fixed enum rather than free text) for EXPANSION_REGION — the two fields
 * are mutually exclusive by kind (see `ActivityStructuredViewModel`), so one
 * modal covers both rather than growing a near-identical second one. Only
 * reachable from the context menu for these three kinds (`useDiagramMenus.ts`)
 * — sequence/interruptible-region nodes have nothing to configure here, same
 * reason they never get this menu item in the first place.
 */
export default function ActivityStructuredNodePropsModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const isOpen = activeModal === 'activity-structured-props' && !!editingId;

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const isStandalone = !!(
    activeTabId &&
    project?.nodes[activeTabId] &&
    (project.nodes[activeTabId] as { standalone?: boolean }).standalone === true
  );

  const getModel = () =>
    isStandalone && activeTabId ? getLocalModel(activeTabId) : useModelStore.getState().model;

  const getNode = (): IRActivityNode | null => {
    if (!editingId) return null;
    return getModel()?.activityNodes?.[editingId] ?? null;
  };

  const node = isOpen ? getNode() : null;
  const isExpansionRegion = node?.activityType === 'EXPANSION_REGION';

  const [testExpression, setTestExpression] = useState('');
  const [mode, setMode] = useState<string>('PARALLEL');

  useEffect(() => {
    if (!isOpen) return;
    const n = getNode();
    setTestExpression(n?.testExpression ?? '');
    setMode(n?.mode ?? 'PARALLEL');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  if (!isOpen || !node) return null;

  const handleSave = () => {
    if (!editingId) return;
    const patch = isExpansionRegion
      ? { mode: mode as 'PARALLEL' | 'ITERATIVE' | 'STREAM' }
      : { testExpression: testExpression.trim() || undefined };
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).updateActivityNode(editingId, patch);
    } else {
      useModelStore.getState().updateActivityNode(editingId, patch);
    }
    closeModals();
  };

  const kindLabel = KIND_LABEL[node.activityType] ?? 'Structured Node';

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={closeModals}
    >
      <div
        className="bg-[#161d2f] border border-[#2a3358] shadow-2xl rounded-lg w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') closeModals();
          if (e.key === 'Enter') handleSave();
        }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2a3358]">
          <div>
            <p className="text-xs text-[#475569] font-mono italic">{isExpansionRegion ? 'mode' : 'testExpression'}</p>
            <h2 className="text-sm font-semibold text-[#e2e8f0]">
              {kindLabel} Properties{node.name ? ` — ${node.name}` : ''}
            </h2>
          </div>
          <button
            onClick={closeModals}
            className="p-1 rounded hover:bg-[#1e2738] text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {isExpansionRegion ? (
            <div>
              <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Mode</label>
              <select
                className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                           text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                autoFocus
              >
                {EXPANSION_MODES.map((m) => (
                  <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[#94a3b8] mb-1">
                {node.activityType === 'LOOP_NODE' ? 'Loop condition' : 'Test'}
              </label>
              <input
                type="text"
                className="w-full bg-[#0f1623] border border-[#2a3358] rounded px-3 py-1.5
                           text-sm text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-[#7C83FF]"
                value={testExpression}
                onChange={(e) => setTestExpression(e.target.value)}
                placeholder={node.activityType === 'LOOP_NODE' ? 'e.g. i < 10' : 'e.g. amount > 1000'}
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 pb-4">
          <button
            onClick={closeModals}
            className="px-3 py-1.5 rounded text-xs text-[#64748b] hover:text-[#94a3b8]
                       hover:bg-[#1e2738] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded text-xs font-medium bg-[#7C83FF]
                       hover:bg-[#9499ff] text-white transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
