import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Plus, LayoutGrid, Shuffle, HelpCircle, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { undoManager } from "../../../../core/undo/instance";
import type { ProjectKind, LibreUMLProject, VFSFolder, VFSFile } from "../../../../core/domain/vfs/vfs.types";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Template = "BLANK" | "ECOMMERCE" | "MICROSERVICES";

export default function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const { t } = useTranslation();
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [projectKind, setProjectKind] = useState<ProjectKind>("FREE");
  const [basePackage, setBasePackage] = useState("com.example.model");
  const [template, setTemplate] = useState<Template>("BLANK");
  const [showKindTooltip, setShowKindTooltip] = useState(false);
  const { loadProject } = useVFSStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setProjectName("");
      setDescription("");
      setProjectKind("FREE");
      setBasePackage("com.example.model");
      setTemplate("BLANK");
      setShowKindTooltip(false);
    }
  }, [isOpen]);

  // Close tooltip on outside click
  useEffect(() => {
    if (!showKindTooltip) return;
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowKindTooltip(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showKindTooltip]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    const now = Date.now();
    const projectId = crypto.randomUUID();
    const modelFileId = crypto.randomUUID();
    const diagramsFolderId = crypto.randomUUID();

    const modelFile: VFSFile = {
      id: modelFileId,
      name: "domain.model",
      type: "FILE",
      parentId: null,
      diagramType: "UNSPECIFIED",
      extension: ".model",
      isExternal: false,
      content: null,
      createdAt: now,
      updatedAt: now,
    };

    const diagramsFolder: VFSFolder = {
      id: diagramsFolderId,
      name: "diagrams",
      type: "FOLDER",
      parentId: null,
      createdAt: now,
      updatedAt: now,
    };

    const project: LibreUMLProject = {
      id: projectId,
      projectName: projectName.trim(),
      description: description.trim() || undefined,
      version: "1.0.0",
      author: "",
      projectKind,
      targetLanguage: "UML Classic",
      basePackage: basePackage.trim() || "com.example.model",
      domainModelId: modelFileId,
      nodes: {
        [modelFileId]: modelFile,
        [diagramsFolderId]: diagramsFolder,
      },
      createdAt: now,
      updatedAt: now,
    };

    undoManager.clear();
    loadProject(project);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  if (!isOpen) return null;

  const kinds: {
    value: ProjectKind;
    icon: React.ReactNode;
    label: string;
    sub: string;
    accentClass: string;
    checkClass: string;
    disabled?: boolean;
  }[] = [
    {
      value: "SOFTWARE_ARCHITECTURE",
      icon: <LayoutGrid className="w-7 h-7" />,
      label: t("createProjectModal.kindSoftwareArchitecture"),
      sub: t("createProjectModal.kindSoftwareArchitectureSub"),
      accentClass: "border-violet-500 bg-violet-900/20",
      checkClass: "bg-violet-600",
      disabled: true,
    },
    {
      value: "FREE",
      icon: <Shuffle className="w-7 h-7" />,
      label: t("createProjectModal.kindFree"),
      sub: t("createProjectModal.kindFreeSub"),
      accentClass: "border-teal-500 bg-teal-900/20",
      checkClass: "bg-teal-500",
    },
  ];

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#12172a] border border-[#252d4a] shadow-2xl rounded-2xl w-full max-w-md relative"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5">
          <div className="w-9 h-9 rounded-xl bg-violet-900/50 border border-violet-700/50 flex items-center justify-center shrink-0">
            <Plus className="w-5 h-5 text-violet-400" />
          </div>
          <h2 className="text-lg font-semibold text-[#e2e8f0] flex-1">
            {t("createProjectModal.title")}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1e2738] transition-colors"
          >
            <X className="w-4 h-4 text-[#64748b] hover:text-[#e2e8f0]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">

          {/* Project Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
              {t("createProjectModal.projectName")} <span className="text-red-400 normal-case">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder={t("createProjectModal.projectNamePlaceholder")}
              className="w-full px-4 py-2.5 bg-[#0d1117] border border-[#252d4a] rounded-xl text-[#e2e8f0] placeholder-[#3d4a6b] text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
              {t("createProjectModal.description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("createProjectModal.descriptionPlaceholder")}
              rows={3}
              className="w-full px-4 py-2.5 bg-[#0d1117] border border-[#252d4a] rounded-xl text-[#e2e8f0] placeholder-[#3d4a6b] text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors resize-none"
            />
          </div>

          {/* Project Kind */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                {t("createProjectModal.projectKind")}
              </label>
              <div className="relative" ref={tooltipRef}>
                <button
                  type="button"
                  onClick={() => setShowKindTooltip((v) => !v)}
                  className="w-5 h-5 rounded-full bg-[#1e2738] hover:bg-[#252d4a] border border-[#252d4a] flex items-center justify-center transition-colors"
                >
                  <HelpCircle className="w-3 h-3 text-[#64748b]" />
                </button>

                {showKindTooltip && (
                  <div className="absolute left-0 top-7 z-50 w-72 bg-[#12172a] border border-[#252d4a] rounded-xl shadow-2xl p-4 text-sm">
                    <p className="font-semibold text-[#e2e8f0] mb-2">
                      {t("createProjectModal.projectKindHelp")}
                    </p>
                    <p className="text-[#94a3b8] mb-2">
                      <span className="text-violet-400 font-semibold">
                        {t("createProjectModal.kindSoftwareArchitecture")}
                      </span>
                      {" — "}
                      {t("createProjectModal.kindSoftwareArchitectureDesc")}
                    </p>
                    <p className="text-[#94a3b8] mb-3">
                      <span className="text-teal-400 font-semibold">
                        {t("createProjectModal.kindFree")}
                      </span>
                      {" — "}
                      {t("createProjectModal.kindFreeDesc")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowKindTooltip(false)}
                      className="text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors"
                    >
                      {t("createProjectModal.closeTooltip")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {kinds.map((kind) => {
                const selected = projectKind === kind.value;
                const isDisabled = kind.disabled;
                return (
                  <button
                    key={kind.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && setProjectKind(kind.value)}
                    title={isDisabled ? "Coming soon" : undefined}
                    className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left ${
                      isDisabled
                        ? "border-[#1e2738] bg-[#0a0e1a] cursor-not-allowed opacity-50"
                        : selected
                          ? kind.accentClass
                          : "border-[#252d4a] bg-[#0d1117] hover:border-[#3d4a6b] hover:bg-[#161d2f]"
                    }`}
                  >
                    {/* Coming soon badge */}
                    {isDisabled && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#1e2738] text-[#64748b] border border-[#252d4a]">
                        Soon
                      </span>
                    )}
                    {/* Selected checkmark */}
                    {selected && !isDisabled && (
                      <span className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center ${kind.checkClass}`}>
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </span>
                    )}
                    <span className={
                      isDisabled
                        ? "text-[#2d3748]"
                        : selected
                          ? kind.value === "SOFTWARE_ARCHITECTURE" ? "text-violet-400" : "text-teal-400"
                          : "text-[#64748b]"
                    }>
                      {kind.icon}
                    </span>
                    <div>
                      <p className={`text-sm font-semibold ${
                        isDisabled ? "text-[#3d4a6b]" : selected ? "text-[#e2e8f0]" : "text-[#94a3b8]"
                      }`}>
                        {kind.label}
                      </p>
                      <p className={`text-xs mt-0.5 ${isDisabled ? "text-[#2d3748]" : "text-[#64748b]"}`}>
                        {kind.sub}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Base Package */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
              {t("createProjectModal.basePackage")}
            </label>
            <input
              type="text"
              value={basePackage}
              onChange={(e) => setBasePackage(e.target.value)}
              placeholder="com.example.model"
              className="w-full px-4 py-2.5 bg-[#0d1117] border border-[#252d4a] rounded-xl text-[#e2e8f0] placeholder-[#3d4a6b] text-sm font-mono focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
            />
          </div>

          {/* Templates */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
              {t("createProjectModal.template")}
            </label>
            <div className="flex items-center gap-2">
              {/* Blank — active */}
              <button
                type="button"
                onClick={() => setTemplate("BLANK")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  template === "BLANK"
                    ? "bg-violet-600 text-white"
                    : "bg-[#1e2738] text-[#94a3b8] hover:bg-[#252d4a]"
                }`}
              >
                {t("createProjectModal.templateBlank")}
              </button>

              {/* E-Commerce — disabled */}
              <button
                type="button"
                disabled
                title="Coming soon"
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[#1e2738] text-[#3d4a6b] cursor-not-allowed select-none"
              >
                {t("createProjectModal.templateEcommerce")}
              </button>

              {/* Microservices — disabled */}
              <button
                type="button"
                disabled
                title="Coming soon"
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[#1e2738] text-[#3d4a6b] cursor-not-allowed select-none"
              >
                {t("createProjectModal.templateMicroservices")}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2738] rounded-xl transition-colors"
            >
              {t("createProjectModal.cancel")}
            </button>
            <button
              type="submit"
              disabled={!projectName.trim()}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:bg-[#1e2738] disabled:text-[#3d4a6b] disabled:cursor-not-allowed rounded-xl transition-colors shadow-md shadow-violet-900/30"
            >
              <Plus className="w-4 h-4" />
              {t("createProjectModal.createProject")}
            </button>
          </div>

        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
