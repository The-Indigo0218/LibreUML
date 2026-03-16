import { X } from "lucide-react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useVFSStore } from "../../../../store/vfs.store";

export default function TabBar() {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useWorkspaceStore();
  const { project } = useVFSStore();

  if (!project || openTabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center bg-surface-primary border-b border-surface-border overflow-x-auto">
      {openTabs.map((tabId) => {
        const node = project.nodes[tabId];
        if (!node || node.type !== "FILE") return null;

        const isActive = tabId === activeTabId;
        const fileName = node.name;

        return (
          <div
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={`
              flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors shrink-0 border-t-2
              ${
                isActive
                  ? "bg-surface-secondary border-blue-500 text-text-primary"
                  : "border-transparent text-text-muted hover:bg-surface-hover hover:text-text-primary"
              }
            `}
          >
            <span className="text-sm">{fileName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tabId);
              }}
              className="p-0.5 hover:bg-surface-hover rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
