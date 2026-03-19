import type { ActivityTab } from "./ActivityBar";
import ProjectStructure from "./ProjectStructure";
import PackageExplorer from "./PackageExplorer";
import ToolPalette from "./ToolPalette";

interface PrimarySideBarProps {
  activeTab: ActivityTab;
}

export default function PrimarySideBar({ activeTab }: PrimarySideBarProps) {
  if (!activeTab) return null;

  return (
    <div className="w-full h-full border-r border-surface-border bg-surface-primary flex flex-col overflow-hidden">
      {activeTab === "structure" && <ProjectStructure />}
      {activeTab === "packages" && <PackageExplorer />}
      {activeTab === "tools" && <ToolPalette />}
      {activeTab === "profile" && <div className="flex-1 p-4 text-text-secondary">User profile coming soon</div>}
      {activeTab === "cloud" && <div className="flex-1 p-4 text-text-secondary">Cloud sync coming soon</div>}
      {activeTab === "github" && <div className="flex-1 p-4 text-text-secondary">GitHub integration coming soon</div>}
      {activeTab === "bug" && <div className="flex-1 p-4 text-text-secondary">Bug report coming soon</div>}
    </div>
  );
}
