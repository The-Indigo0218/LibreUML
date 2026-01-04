import { useState } from "react";
import { createPortal } from "react-dom";
import type { UmlClassData } from "../../../types/diagram.types";
import DynamicList from "../../../components/shared/DynamicList";

interface ClassEditorModalProps {
  isOpen: boolean;
  umlData: UmlClassData;
  onSave: (data: UmlClassData) => void;
  onClose: () => void;
}

export default function ClassEditorModal({
  isOpen,
  umlData,
  onSave,
  onClose,
}: ClassEditorModalProps) {
  const [draft, setDraft] = useState<UmlClassData>(umlData);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft({ ...draft, label: e.target.value });
  };

  /* Handling attributes | methods changes */
  const handleListChange = (
    field: "attributes" | "methods",
    index: number,
    newValue: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? newValue : item)),
    }));
  };

  const addListItem = (field: "attributes" | "methods") => {
    setDraft((prev) => ({
      ...prev,
      [field]: [...prev[field], ""],
    }));
  };

  const removeListItem = (
    field: "attributes" | "methods",
    indexToRemove: number
  ) => {
    setDraft((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, index) => index !== indexToRemove),
    }));
  };

  const handleSave = () => {
    if (draft.label.trim() === "") return;
    const sanitizedData: UmlClassData = {
      ...draft,
      attributes: draft.attributes.filter((attr) => attr.trim() !== ""),
      methods: draft.methods.filter((meth) => meth.trim() !== ""),
    };

    onSave(sanitizedData);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-2xl w-96 text-white">
        <h2 className="text-xl font-bold mb-4">Edit Class</h2>

        {/* Input for the className (label) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-400 mb-1">
            Class Name
          </label>
          <input
            type="text"
            value={draft.label}
            onChange={handleLabelChange}
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          />
          {draft.label.trim() === "" && (
            <p className="text-red-500 text-xs mt-1">
              Class name cannot be empty.
            </p>
          )}
        </div>

        {/* Attributes Section */}
        <DynamicList
          label="Attributes"
          items={draft.attributes}
          onItemChange={(index, value) =>
            handleListChange("attributes", index, value)
          }
          onAddItem={() => addListItem("attributes")}
          onRemoveItem={(index) => removeListItem("attributes", index)}
        />

        {/* Methods Section */}
        <DynamicList
          label="Methods"
          items={draft.methods}
          onItemChange={(index, value) =>
            handleListChange("methods", index, value)
          }
          onAddItem={() => addListItem("methods")}
          onRemoveItem={(index) => removeListItem("methods", index)}
        />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave()}
            disabled={draft.label.trim() === ""}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded font-medium transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
