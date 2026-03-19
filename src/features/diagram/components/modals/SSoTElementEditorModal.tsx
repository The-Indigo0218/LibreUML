import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useUiStore } from "../../../../store/uiStore";
import { useModelStore } from "../../../../store/model.store";
import { useToastStore } from "../../../../store/toast.store";
import type {
  IRClass,
  IRInterface,
  IREnum,
  Visibility,
  SemanticModel,
} from "../../../../core/domain/vfs/vfs.types";

// ─── Element resolution ───────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: "public", label: "public" },
  { value: "private", label: "private" },
  { value: "protected", label: "protected" },
  { value: "package", label: "package" },
];

const SSOT_TOAST_MESSAGE =
  "Changes will be reflected across all diagrams in this project.";

// ─── Component ────────────────────────────────────────────────────────────────

export default function SSoTElementEditorModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const model = useModelStore((s) => s.model);
  const updateClass = useModelStore((s) => s.updateClass);
  const updateInterface = useModelStore((s) => s.updateInterface);
  const updateEnum = useModelStore((s) => s.updateEnum);
  const showToast = useToastStore((s) => s.show);

  const isOpen = activeModal === "ssot-element-editor" && !!editingId;

  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [isAbstract, setIsAbstract] = useState(false);

  // Sync local form state with ModelStore element whenever the modal opens.
  useEffect(() => {
    if (!isOpen || !editingId || !model) return;
    const el = resolveElement(model, editingId);
    if (!el) return;
    setName(el.data.name);
    setVisibility(el.data.visibility ?? "public");
    setIsAbstract(el.kind === "CLASS" ? !!el.data.isAbstract : false);
  }, [isOpen, editingId, model]);

  if (!isOpen || !editingId || !model) return null;

  const element = resolveElement(model, editingId);
  if (!element) return null;

  // ── Derived display values ──────────────────────────────────────────────────

  const isAbstractClass = element.kind === "CLASS" && !!element.data.isAbstract;
  const kindLabel =
    element.kind === "CLASS"
      ? isAbstractClass
        ? "Abstract Class"
        : "Class"
      : element.kind === "INTERFACE"
        ? "Interface"
        : "Enum";

  const badgeLabel =
    element.kind === "CLASS" ? (isAbstractClass ? "A" : "C") :
    element.kind === "INTERFACE" ? "I" : "E";

  const badgeClass =
    element.kind === "CLASS"
      ? isAbstractClass
        ? "bg-purple-500/20 text-purple-400"
        : "bg-blue-500/20 text-blue-400"
      : element.kind === "INTERFACE"
        ? "bg-emerald-500/20 text-emerald-400"
        : "bg-amber-500/20 text-amber-400";

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (element.kind === "CLASS") {
      updateClass(editingId, { name: trimmed, visibility, isAbstract });
    } else if (element.kind === "INTERFACE") {
      updateInterface(editingId, { name: trimmed, visibility });
    } else {
      updateEnum(editingId, { name: trimmed, visibility });
    }

    showToast(SSOT_TOAST_MESSAGE);
    closeModals();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) handleSave();
    if (e.key === "Escape") closeModals();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={closeModals}
    >
      <div
        className="bg-[#0d1117] border border-[#1e2738] rounded-xl shadow-2xl w-96 text-slate-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2738]">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded ${badgeClass}`}
            >
              {badgeLabel}
            </span>
            <h2 className="text-sm font-semibold">Edit {kindLabel}</h2>
          </div>
          <button
            onClick={closeModals}
            className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Name
            </label>
            <input
              autoFocus
              className="w-full bg-[#161b22] border border-[#1e2738] rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500/60 transition-colors"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Visibility
            </label>
            <select
              className="w-full bg-[#161b22] border border-[#1e2738] rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500/60 transition-colors"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Abstract toggle — classes only */}
          {element.kind === "CLASS" && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAbstract}
                onChange={(e) => setIsAbstract(e.target.checked)}
                className="accent-purple-500 w-3.5 h-3.5"
              />
              <span className="text-sm text-slate-400">Abstract class</span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#1e2738]">
          <button
            onClick={closeModals}
            className="px-4 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-5 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
