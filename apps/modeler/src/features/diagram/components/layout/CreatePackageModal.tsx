import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface CreatePackageModalProps {
  isOpen: boolean;
  existingNames: string[];
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export default function CreatePackageModal({
  isOpen,
  existingNames,
  onConfirm,
  onClose,
}: CreatePackageModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [validationError, setValidationError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setValidationError("");
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (existingNames.includes(trimmed)) {
      setValidationError(t("sidebar.packageNameExists"));
      return;
    }
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#161d2f] border border-[#2a3358] shadow-2xl rounded-lg w-full max-w-md relative z-[10000] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h2 className="text-xl font-semibold text-[#e2e8f0]">
            {t("sidebar.newPackageTitle")}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#1e2738] rounded transition-colors"
          >
            <X className="w-5 h-5 text-[#94a3b8] hover:text-[#e2e8f0]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-6 pb-4">
            <label
              htmlFor="newPackageName"
              className="block text-sm font-medium text-[#cbd5e1] mb-2"
            >
              {t("sidebar.newPackagePrompt")}
            </label>
            <input
              ref={inputRef}
              id="newPackageName"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setValidationError("");
              }}
              placeholder="com.example.models"
              className={`w-full px-3 py-2 bg-[#0f1419] border rounded-lg text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:ring-2 ${
                validationError
                  ? "border-red-500 focus:ring-red-500"
                  : "border-[#2a3358] focus:ring-[#7C83FF]"
              }`}
            />
            {validationError && (
              <p className="text-xs text-red-400 mt-1">{validationError}</p>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2a3358] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#cbd5e1] bg-[#1e2738] hover:bg-[#2a3358] hover:text-[#e2e8f0] rounded-lg transition-colors"
            >
              {t("createFileModal.cancel")}
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-[#374151] disabled:text-[#9ca3af] disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {t("sidebar.createPackage")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
