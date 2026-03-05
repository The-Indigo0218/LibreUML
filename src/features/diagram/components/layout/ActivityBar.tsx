import { Folder, Wrench } from "lucide-react";
import { useSettingsStore } from "../../../../store/settingsStore";

export type ActivityTab = "explorer" | "tools" | null;

interface ActivityBarProps {
  activeTab: ActivityTab;
  onTabChange: (tab: ActivityTab) => void;
}

export default function ActivityBar({ activeTab, onTabChange }: ActivityBarProps) {
  const theme = useSettingsStore((state) => state.theme);
  const isDark = theme === "dark";

  const handleTabClick = (tab: ActivityTab) => {
    onTabChange(activeTab === tab ? null : tab);
  };

  return (
    <aside className={`w-12 border-r flex flex-col items-center py-2 gap-1 z-20 ${
      isDark ? 'bg-[#0b0f1a] border-[#454545]' : 'bg-[#2c2c2c] border-[#3e3e3e]'
    }`}>
      <ActivityBarIcon
        icon={<Folder className="w-5 h-5" />}
        label="Explorador de Paquetes"
        isActive={activeTab === "explorer"}
        onClick={() => handleTabClick("explorer")}
        isDark={isDark}
      />
      
      <ActivityBarIcon
        icon={<Wrench className="w-5 h-5" />}
        label="Herramientas de Diagrama"
        isActive={activeTab === "tools"}
        onClick={() => handleTabClick("tools")}
        isDark={isDark}
      />
    </aside>
  );
}

interface ActivityBarIconProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isDark: boolean;
}

function ActivityBarIcon({ icon, label, isActive, onClick, isDark }: ActivityBarIconProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`
        w-10 h-10 flex items-center justify-center rounded-md transition-all duration-200
        ${isActive 
          ? `${isDark ? 'bg-[#37373d]' : 'bg-[#505050]'} text-white border-l-2 border-blue-500` 
          : `${isDark ? 'text-[#858585] hover:text-white hover:bg-[#2a2a2a]' : 'text-[#cccccc] hover:text-white hover:bg-[#3e3e3e]'}`
        }
      `}
    >
      {icon}
    </button>
  );
}
