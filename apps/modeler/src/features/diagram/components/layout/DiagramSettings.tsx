import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import type { VFSFile } from "../../../../core/domain/vfs/vfs.types";

export default function DiagramSettings() {
  const { activeTabId } = useWorkspaceStore();
  const { project, updateNode, initLocalModel } = useVFSStore();
  const { t } = useTranslation();

  if (!activeTabId || !project) return null;

  const node = project.nodes[activeTabId];
  if (!node || node.type !== "FILE") return null;

  const file = node as VFSFile;
  const isStandalone = file.standalone === true;

  const handleToggle = () => {
    if (isStandalone) {
      updateNode(activeTabId, { standalone: false, localModel: null });
    } else {
      updateNode(activeTabId, { standalone: true });
      initLocalModel(activeTabId);
    }
  };

  return (
    <div className="flex items-start gap-3 px-3 py-3 rounded-lg border border-[#2a3358] bg-[#0f1419]">
      <button
        type="button"
        role="switch"
        aria-checked={isStandalone}
        onClick={handleToggle}
        className={`relative mt-0.5 shrink-0 w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C83FF] ${
          isStandalone ? "bg-[#7C83FF]" : "bg-[#2a3358]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            isStandalone ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
      <div className="flex flex-col gap-0.5">
        <label
          className="text-sm font-medium text-[#cbd5e1] cursor-pointer select-none"
          onClick={handleToggle}
        >
          {t("createFileModal.standaloneLabel")}
        </label>
        <p className="text-xs text-[#64748b] leading-snug">
          {t("createFileModal.standaloneDescription")}
        </p>
      </div>
    </div>
  );
}
