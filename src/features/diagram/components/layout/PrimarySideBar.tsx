import type { ActivityTab } from "./ActivityBar";
import DiagramExplorer from "../../../workspace/components/DiagramExplorer";
import PackageExplorer from "./PackageExplorer";
import Sidebar from "./Sidebar";
import { TimelinePanel } from "../timeline/TimelinePanel";
import { useSettingsStore } from "../../../../store/settingsStore";

interface PrimarySideBarProps {
  activeTab: ActivityTab;
}

export default function PrimarySideBar({ activeTab }: PrimarySideBarProps) {
  const theme = useSettingsStore((state) => state.theme);
  const isDark = theme === "dark";

  if (!activeTab) return null;

  return (
    <div className={`w-64 border-r flex flex-col z-10 shadow-xl ${
      isDark ? 'bg-[#0b0f1a] border-[#2d2d2d]' : 'bg-[#f3f3f3] border-[#e0e0e0]'
    }`}>
      {activeTab === "explorer" && <DiagramExplorer />}
      {activeTab === "packages" && <PackageExplorer />}
      {activeTab === "tools" && <Sidebar />}
      {activeTab === "timeline" && <TimelinePanel />}
    </div>
  );
}
