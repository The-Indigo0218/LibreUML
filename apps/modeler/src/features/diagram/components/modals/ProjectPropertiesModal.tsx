import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { X, Settings } from "lucide-react";
import { useVFSStore } from "../../../../store/project-vfs.store";

const TARGET_LANGUAGES = [
  "UML Classic",
  "Java",
  "C#",
  "TypeScript",
  "Python",
] as const;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ProjectPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectPropertiesModal({
  isOpen,
  onClose,
}: ProjectPropertiesModalProps) {
  const { t } = useTranslation();
  const project = useVFSStore((s) => s.project);
  const updateProjectProperties = useVFSStore((s) => s.updateProjectProperties);

  const [version, setVersion] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("UML Classic");
  const [basePackage, setBasePackage] = useState("com.example.model");

  useEffect(() => {
    if (isOpen && project) {
      setVersion(project.version ?? "1.0.0");
      setAuthor(project.author ?? "");
      setDescription(project.description ?? "");
      setTargetLanguage(project.targetLanguage ?? "UML Classic");
      setBasePackage(project.basePackage ?? "com.example.model");
    }
  }, [isOpen, project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProjectProperties({
      version: version.trim() || "1.0.0",
      author: author.trim(),
      description: description.trim(),
      targetLanguage,
      basePackage: basePackage.trim(),
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  if (!isOpen || !project) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-[#161d2f] border border-[#2a3358] shadow-2xl rounded-lg w-full max-w-lg relative z-[10000] p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-[#e2e8f0]">
              {t("projectPropertiesModal.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#1e2738] rounded transition-colors"
          >
            <X className="w-4 h-4 text-[#94a3b8] hover:text-[#e2e8f0]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <span className="block text-xs font-medium text-[#64748b] mb-1 uppercase tracking-wide">
              {t("projectPropertiesModal.projectName")}
            </span>
            <p className="px-3 py-2 bg-[#0f1419]/50 border border-[#1e2738] rounded-lg text-[#64748b] text-sm select-all">
              {project.projectName}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="pp-version"
                className="block text-sm font-medium text-[#cbd5e1] mb-1"
              >
                {t("projectPropertiesModal.version")}
              </label>
              <input
                id="pp-version"
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder={t("projectPropertiesModal.versionPlaceholder")}
                className="w-full px-3 py-2 bg-[#0f1419] border border-[#2a3358] rounded-lg text-[#e2e8f0] placeholder-[#64748b] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C83FF]"
              />
            </div>
            <div>
              <label
                htmlFor="pp-author"
                className="block text-sm font-medium text-[#cbd5e1] mb-1"
              >
                {t("projectPropertiesModal.author")}
              </label>
              <input
                id="pp-author"
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder={t("projectPropertiesModal.authorPlaceholder")}
                className="w-full px-3 py-2 bg-[#0f1419] border border-[#2a3358] rounded-lg text-[#e2e8f0] placeholder-[#64748b] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C83FF]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="pp-description"
              className="block text-sm font-medium text-[#cbd5e1] mb-1"
            >
              {t("projectPropertiesModal.description")}
            </label>
            <textarea
              id="pp-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("projectPropertiesModal.descriptionPlaceholder")}
              rows={2}
              className="w-full px-3 py-2 bg-[#0f1419] border border-[#2a3358] rounded-lg text-[#e2e8f0] placeholder-[#64748b] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C83FF] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="pp-targetLanguage"
                className="block text-sm font-medium text-[#cbd5e1] mb-1"
              >
                {t("projectPropertiesModal.targetLanguage")}
              </label>
              <select
                id="pp-targetLanguage"
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f1419] border border-[#2a3358] rounded-lg text-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C83FF]"
              >
                {TARGET_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="pp-basePackage"
                className="block text-sm font-medium text-[#cbd5e1] mb-1"
              >
                {t("projectPropertiesModal.basePackage")}
              </label>
              <input
                id="pp-basePackage"
                type="text"
                value={basePackage}
                onChange={(e) => setBasePackage(e.target.value)}
                placeholder={t("projectPropertiesModal.basePackagePlaceholder")}
                className="w-full px-3 py-2 bg-[#0f1419] border border-[#2a3358] rounded-lg text-[#e2e8f0] placeholder-[#64748b] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C83FF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <span className="block text-xs font-medium text-[#64748b] mb-1 uppercase tracking-wide">
                {t("projectPropertiesModal.created")}
              </span>
              <span className="text-xs text-[#475569]">
                {formatDate(project.createdAt)}
              </span>
            </div>
            <div>
              <span className="block text-xs font-medium text-[#64748b] mb-1 uppercase tracking-wide">
                {t("projectPropertiesModal.lastModified")}
              </span>
              <span className="text-xs text-[#475569]">
                {formatDate(project.updatedAt)}
              </span>
            </div>
          </div>

          <div className="h-px bg-[#1e2738]" />

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#cbd5e1] bg-[#1e2738] hover:bg-[#2a3358] rounded-lg transition-colors"
            >
              {t("projectPropertiesModal.cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              {t("projectPropertiesModal.saveChanges")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
