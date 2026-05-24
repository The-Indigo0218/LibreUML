import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useVFSStore } from '../../../../store/project-vfs.store';
import type { VFSFile } from '../../../../core/domain/vfs/vfs.types';

interface DiagramSettingsProps {
  fileId: string;
  /** Position of the gear button that opened this panel (for anchoring). */
  anchor: { top: number; right: number };
  onClose: () => void;
}

export default function DiagramSettings({ fileId, anchor, onClose }: DiagramSettingsProps) {
  const project = useVFSStore((s) => s.project);
  const updateNode = useVFSStore((s) => s.updateNode);
  const initLocalModel = useVFSStore((s) => s.initLocalModel);

  const panelRef = useRef<HTMLDivElement>(null);

  const file = project?.nodes[fileId];
  const isFile = file?.type === 'FILE';
  const standalone = isFile ? (file as VFSFile).standalone ?? false : false;

  // Close on Escape or click-outside.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    // Defer the outside-click listener by one tick so the opening click
    // doesn't immediately close the panel.
    const t = setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => {
      document.removeEventListener('keydown', handleKey);
      clearTimeout(t);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  if (!isFile) return null;

  const handleStandaloneToggle = () => {
    const next = !standalone;
    if (next) {
      // Ensure localModel exists before marking standalone.
      initLocalModel(fileId);
    }
    updateNode(fileId, { standalone: next });
  };

  const panel = (
    <div
      ref={panelRef}
      style={{ position: 'fixed', top: anchor.top, right: anchor.right, zIndex: 9999 }}
      className="w-72 bg-[#161d2f] border border-[#2a3358] shadow-2xl rounded-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#2a3358]">
        <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
          Diagram Settings
        </h3>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-[#1e2738] text-[#64748b] hover:text-[#94a3b8] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Settings rows */}
      <div className="px-4 py-3 space-y-3">
        {/* Standalone toggle */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium text-[#cbd5e1]">Standalone Mode</span>
            <p className="text-[11px] text-[#64748b] leading-snug">
              Isolates this diagram from the shared workspace model.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={standalone}
            onClick={handleStandaloneToggle}
            className={`relative mt-0.5 shrink-0 w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C83FF] ${
              standalone ? 'bg-[#7C83FF]' : 'bg-[#2a3358]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                standalone ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
