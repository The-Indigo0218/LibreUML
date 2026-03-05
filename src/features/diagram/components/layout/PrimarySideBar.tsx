import type { ActivityTab } from "./ActivityBar";
import PackageExplorer from "./PackageExplorer";
import Sidebar from "./Sidebar";
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
      isDark ? 'bg-[#252526] border-[#2d2d2d]' : 'bg-[#f3f3f3] border-[#e0e0e0]'
    }`}>
      {activeTab === "explorer" && <PackageExplorer />}
      {activeTab === "tools" && <Sidebar />}
    </div>
  );
}
