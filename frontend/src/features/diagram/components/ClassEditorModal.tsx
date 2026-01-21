import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useDiagramStore } from "../../../store/diagramStore";
import type {
  UmlClassData,
  UmlAttribute,
  UmlMethod, 
  visibility as Visibility,
} from "../../../types/diagram.types";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ClassEditorModalProps {
  isOpen: boolean;
  umlData: UmlClassData;
  onSave: (data: UmlClassData) => void;
  onClose: () => void;
}

const PRIMITIVE_TYPES = [
  "String",
  "int",
  "boolean",
  "void",
  "double",
  "float",
  "char",
  "Date",
];

const VISIBILITY_OPTIONS: Visibility[] = ["+", "-", "#", "~"];

export default function ClassEditorModal({
  isOpen,
  umlData,
  onSave,
  onClose,
}: ClassEditorModalProps) {
  const nodes = useDiagramStore((state) => state.nodes);
  const { t } = useTranslation();

  const availableTypes = useMemo(() => {
    const classTypes = nodes
      .filter((node) => node.type === "umlClass") 
      .map((node) => node.data.label);
    return [...PRIMITIVE_TYPES, ...classTypes];
  }, [nodes]);

  const [draft, setDraft] = useState<UmlClassData>(() => ({
    ...umlData,
    attributes:
      Array.isArray(umlData.attributes) &&
      typeof umlData.attributes[0] === "string"
        ? []
        : umlData.attributes || [],
    methods:
      Array.isArray(umlData.methods) && typeof umlData.methods[0] === "string"
        ? []
        : umlData.methods || [],
  }));

  // --- LOGIC: ATTRIBUTES ---
  const addAttribute = () => {
    const newAttr: UmlAttribute = {
      id: crypto.randomUUID(),
      visibility: "-",
      name: "newAttr",
      type: "String",
      isArray: false,
    };
    setDraft((prev) => ({
      ...prev,
      attributes: [...prev.attributes, newAttr],
    }));
  };

  const updateAttribute = (
    index: number,
    field: keyof UmlAttribute,
    value: string | boolean,
  ) => {
    const newAttrs = [...draft.attributes];
    newAttrs[index] = { ...newAttrs[index], [field]: value };
    setDraft((prev) => ({ ...prev, attributes: newAttrs }));
  };

  const removeAttribute = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      attributes: prev.attributes.filter((_, i) => i !== index),
    }));
  };

  // --- LOGIC: METHODS ---
  const addMethod = () => {
    const newMethod: UmlMethod = {
      id: crypto.randomUUID(),
      visibility: "+",
      name: "newMethod",
      returnType: "void",
      parameters: [],
    };
    setDraft((prev) => ({ ...prev, methods: [...prev.methods, newMethod] }));
  };

  const updateMethod = (
    index: number,
    field: keyof UmlMethod,
    value: string,
  ) => {
    const newMethods = [...draft.methods];
    newMethods[index] = { ...newMethods[index], [field]: value };
    setDraft((prev) => ({ ...prev, methods: newMethods }));
  };

  const removeMethod = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      methods: prev.methods.filter((_, i) => i !== index),
    }));
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm font-sans">
      <div className="bg-surface-primary border border-surface-border p-6 rounded-xl shadow-2xl w-150 text-text-primary max-h-[90vh] overflow-y-auto custom-scrollbar">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="text-uml-class-border">{t('modals.classEditor.title')}</span>{draft.label}
        </h2>

        <div className="mb-6">
          <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
            {t('modals.classEditor.className')}
          </label>
          <input
            className="w-full bg-surface-secondary border border-surface-border rounded p-2 text-text-primary focus:border-uml-class-border outline-none"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              {t('modals.classEditor.attributes')}
            </label>
            <button
              onClick={addAttribute}
              className="text-xs flex items-center gap-1 text-green-400 hover:text-green-300"
            >
              <Plus className="w-3 h-3" /> {t('modals.classEditor.add')}
            </button>
          </div>

          <div className="space-y-2">
            {draft.attributes.map((attr, idx) => (
              <div
                key={attr.id}
                className="flex items-center gap-2 bg-surface-secondary p-2 rounded border border-surface-border"
              >
                <select
                  className="bg-transparent text-uml-abstract-border font-mono outline-none cursor-pointer"
                  value={attr.visibility}
                  onChange={(e) =>
                    updateAttribute(idx, "visibility", e.target.value)
                  }
                >
                  {VISIBILITY_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>

                <input
                  className="bg-transparent border-b border-transparent focus:border-uml-class-border outline-none flex-1 min-w-0 text-sm"
                  placeholder={t('modals.classEditor.placeholders.name')}
                  value={attr.name}
                  onChange={(e) => updateAttribute(idx, "name", e.target.value)}
                />

                <span className="text-text-muted">:</span>

                <select
                  className="bg-surface-primary border border-surface-border rounded px-2 py-1 text-xs text-uml-interface-border outline-none w-32"
                  value={attr.type}
                  onChange={(e) => updateAttribute(idx, "type", e.target.value)}
                >
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <label
                  className="flex items-center gap-1 cursor-pointer"
                  title="Is Array?"
                >
                  <input
                    type="checkbox"
                    checked={attr.isArray}
                    onChange={(e) =>
                      updateAttribute(idx, "isArray", e.target.checked)
                    }
                    className="accent-uml-class-border"
                  />
                  <span className="text-[10px] text-text-muted">[]</span>
                </label>

                <button
                  onClick={() => removeAttribute(idx)}
                  className="text-red-400 hover:text-red-300 ml-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {draft.attributes.length === 0 && (
              <div className="text-center py-4 text-text-muted text-xs italic border border-dashed border-surface-border rounded">
                {t('modals.classEditor.noAttributes')}
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
             {t('modals.classEditor.methods')}
            </label>
            <button
              onClick={addMethod}
              className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300"
            >
              <Plus className="w-3 h-3" /> {t('modals.classEditor.add')}
            </button>
          </div>

          <div className="space-y-2">
            {draft.methods.map((method, idx) => (
              <div
                key={method.id}
                className="flex items-center gap-2 bg-surface-secondary p-2 rounded border border-surface-border"
              >
                <select
                  className="bg-transparent text-uml-abstract-border font-mono outline-none cursor-pointer"
                  value={method.visibility}
                  onChange={(e) =>
                    updateMethod(idx, "visibility", e.target.value)
                  }
                >
                  {VISIBILITY_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>

                <input
                  className="bg-transparent border-b border-transparent focus:border-uml-class-border outline-none flex-1 min-w-0 text-sm"
                  placeholder={t('modals.classEditor.placeholders.name')}
                  value={method.name}
                  onChange={(e) => updateMethod(idx, "name", e.target.value)}
                />

                <span className="text-text-muted">():</span>

                <select
                  className="bg-surface-primary border border-surface-border rounded px-2 py-1 text-xs text-uml-interface-border outline-none w-32"
                  value={method.returnType}
                  onChange={(e) =>
                    updateMethod(idx, "returnType", e.target.value)
                  }
                >
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => removeMethod(idx)}
                  className="text-red-400 hover:text-red-300 ml-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {draft.methods.length === 0 && (
              <div className="text-center py-4 text-text-muted text-xs italic border border-dashed border-surface-border rounded">
                {t('modals.classEditor.noMethods')}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-surface-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            {t('modals.classEditor.cancel')}
          </button>
          <button
            onClick={() => onSave(draft)}
            className="px-6 py-2 text-sm bg-uml-class-border text-white rounded font-medium hover:brightness-110"
          >
            {t('modals.classEditor.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
