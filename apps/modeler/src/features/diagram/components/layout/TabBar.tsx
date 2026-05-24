import { useState } from "react";
import { X, Settings } from "lucide-react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import DiagramSettings from "./DiagramSettings";

export default function TabBar() {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useWorkspaceStore();
  const { project } = useVFSStore();

  const [settingsOpenId, setSettingsOpenId] = useState<string | null>(null);
  const [settingsAnchor, setSettingsAnchor] = useState<{ top: number; right: number } | null>(null);

  if (!project || openTabs.length === 0) {
    return null;
  }

  const handleGearClick = (e: React.MouseEvent<HTMLButtonElement>, tabId: string) => {
    e.stopPropagation();
    if (settingsOpenId === tabId) {
      setSettingsOpenId(null);
      setSettingsAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setSettingsOpenId(tabId);
      setSettingsAnchor({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  };

  return (
    <>
      <div className="flex items-center bg-surface-primary border-b border-surface-border overflow-x-auto">
        {openTabs.map((tabId) => {
          const node = project.nodes[tabId];
          if (!node || node.type !== "FILE") return null;

          const isActive = tabId === activeTabId;
          const fileName = node.name;
          const isSettingsOpen = settingsOpenId === tabId;

          return (
            <div
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`
                flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-colors shrink-0 border-t-2
                ${
                  isActive
                    ? "bg-surface-secondary border-blue-500 text-text-primary"
                    : "border-transparent text-text-muted hover:bg-surface-hover hover:text-text-primary"
                }
              `}
            >
              <span className="text-sm px-1">{fileName}</span>

              {/* Gear icon — always visible on active tab, hover-visible on inactive */}
              <button
                onClick={(e) => handleGearClick(e, tabId)}
                title="Diagram settings"
                className={`p-0.5 rounded transition-colors ${
                  isSettingsOpen
                    ? "text-[#7C83FF] bg-[#7C83FF]/10"
                    : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
                } ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {/* Close tab */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (settingsOpenId === tabId) {
                    setSettingsOpenId(null);
                    setSettingsAnchor(null);
                  }
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

      {settingsOpenId && settingsAnchor && (
        <DiagramSettings
          fileId={settingsOpenId}
          anchor={settingsAnchor}
          onClose={() => {
            setSettingsOpenId(null);
            setSettingsAnchor(null);
          }}
        />
      )}
    </>
  );
}
