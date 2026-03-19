import { createPortal } from "react-dom";
import { TriangleAlert, X } from "lucide-react";
import { useUiStore } from "../../../../store/uiStore";
import { useModelStore } from "../../../../store/model.store";
import { useVFSStore } from "../../../../store/vfs.store";
import { useToastStore } from "../../../../store/toast.store";
import type {
  IRClass,
  IRInterface,
  IREnum,
  SemanticModel,
} from "../../../../core/domain/vfs/vfs.types";

// ─── Element resolution (shared with SSoTElementEditorModal) ─────────────────

type EditableElement =
  | { kind: "CLASS"; data: IRClass }
  | { kind: "INTERFACE"; data: IRInterface }
  | { kind: "ENUM"; data: IREnum };

function resolveElement(model: SemanticModel, id: string): EditableElement | null {
  if (model.classes[id]) return { kind: "CLASS", data: model.classes[id] };
  if (model.interfaces[id]) return { kind: "INTERFACE", data: model.interfaces[id] };
  if (model.enums[id]) return { kind: "ENUM", data: model.enums[id] };
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobalDeleteModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const model = useModelStore((s) => s.model);
  const deleteClass = useModelStore((s) => s.deleteClass);
  const deleteInterface = useModelStore((s) => s.deleteInterface);
  const deleteEnum = useModelStore((s) => s.deleteEnum);
  const purgeElementFromAllDiagrams = useVFSStore((s) => s.purgeElementFromAllDiagrams);
  const showToast = useToastStore((s) => s.show);

  const isOpen = activeModal === "global-delete" && !!editingId;

  if (!isOpen || !editingId || !model) return null;

  const element = resolveElement(model, editingId);
  if (!element) return null;

  const kindLabel =
    element.kind === "CLASS"
      ? element.data.isAbstract
        ? "abstract class"
        : "class"
      : element.kind === "INTERFACE"
        ? "interface"
        : "enum";

  // ── Cascade deletion ───────────────────────────────────────────────────────

  const handleConfirm = () => {
    const elementName = element.data.name;

    // Step 1: Snapshot all relation IDs that reference this element BEFORE
    // ModelStore deletes them. The ModelStore's cascadeDeleteRelations runs
    // inside immer — IDs are gone by the time the setter returns.
    const deletedRelationIds = new Set(
      Object.values(model.relations)
        .filter((r) => r.sourceId === editingId || r.targetId === editingId)
        .map((r) => r.id),
    );

    // Step 2: Remove the element (and its relations) from ModelStore.
    if (element.kind === "CLASS") {
      deleteClass(editingId);
    } else if (element.kind === "INTERFACE") {
      deleteInterface(editingId);
    } else {
      deleteEnum(editingId);
    }

    // Step 3: Purge every VFS diagram file — remove matching ViewNodes and
    // ViewEdges so no ghost references remain, even in files not currently open.
    purgeElementFromAllDiagrams(editingId, deletedRelationIds);

    // Step 4: Feedback + close.
    showToast(`"${elementName}" and all its references have been removed from the project.`);
    closeModals();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) handleConfirm();
    if (e.key === "Escape") closeModals();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={closeModals}
    >
      <div
        className="bg-[#0d1117] border border-red-900/50 rounded-xl shadow-2xl w-[440px] text-slate-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-red-900/30">
          <div className="flex items-center gap-2.5">
            <TriangleAlert className="w-4 h-4 text-red-400 shrink-0" />
            <h2 className="text-sm font-semibold text-red-300">Delete from Project</h2>
          </div>
          <button
            onClick={closeModals}
            className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">
            This will permanently delete{" "}
            <span className="font-semibold text-white">
              &ldquo;{element.data.name}&rdquo;
            </span>{" "}
            ({kindLabel}) from the entire project.
          </p>
          <p className="text-sm text-slate-400 leading-relaxed">
            It will be removed from{" "}
            <span className="text-red-400 font-medium">ALL diagrams</span>, along with
            any associations, generalizations, or other relations that connect to it.
          </p>
          <div className="flex items-start gap-2 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2.5 mt-1">
            <TriangleAlert className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 leading-relaxed">
              This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-red-900/30">
          <button
            autoFocus
            onClick={closeModals}
            className="px-4 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-1.5 text-sm bg-red-700 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
          >
            Delete from Project
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
