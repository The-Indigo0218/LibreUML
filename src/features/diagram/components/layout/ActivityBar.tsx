import { Files, Package, Wrench, Clock, UserCircle2, Cloud, Github, Bug } from "lucide-react";
import { useSettingsStore } from "../../../../store/settingsStore";
import { useTranslation } from "react-i18next";

export type ActivityTab = "explorer" | "packages" | "tools" | "timeline" | null;

interface ActivityBarProps {
  activeTab: ActivityTab;
  onTabChange: (tab: ActivityTab) => void;
}

export default function ActivityBar({ activeTab, onTabChange }: ActivityBarProps) {
  const { t } = useTranslation();
  const theme = useSettingsStore((state) => state.theme);
  const isDark = theme === "dark";

  const handleTabClick = (tab: ActivityTab) => {
    onTabChange(activeTab === tab ? null : tab);
  };

  const handleBottomAction = (action: string) => {
    console.log(`${action} clicked`);
    // TODO: Implement actual functionality in future phases
  };

  return (
    <aside className={`w-12 border-r flex flex-col items-center py-2 z-20 ${
      isDark ? 'bg-[#0b0f1a] border-[#454545]' : 'bg-[#2c2c2c] border-[#3e3e3e]'
    }`}>
      {/* Top Section - Main Navigation */}
      <div className="flex flex-col items-center gap-1">
        <ActivityBarIcon
          icon={<Files className="w-5 h-5" />}
          label={t("activityBar.diagrams")}
          isActive={activeTab === "explorer"}
          onClick={() => handleTabClick("explorer")}
          isDark={isDark}
        />

        <ActivityBarIcon
          icon={<Package className="w-5 h-5" />}
          label={t("activityBar.packages")}
          isActive={activeTab === "packages"}
          onClick={() => handleTabClick("packages")}
          isDark={isDark}
        />
        
        <ActivityBarIcon
          icon={<Wrench className="w-5 h-5" />}
          label={t("activityBar.tools")}
          isActive={activeTab === "tools"}
          onClick={() => handleTabClick("tools")}
          isDark={isDark}
        />

        <ActivityBarIcon
          icon={<Clock className="w-5 h-5" />}
          label={t("activityBar.timeline")}
          isActive={activeTab === "timeline"}
          onClick={() => handleTabClick("timeline")}
          isDark={isDark}
        />
      </div>

      {/* Bottom Section - Actions */}
      <div className="mt-auto flex flex-col items-center gap-1">
        <ActivityBarIcon
          icon={<UserCircle2 className="w-5 h-5" />}
          label={t("activityBar.profile")}
          isActive={false}
          onClick={() => handleBottomAction("Profile")}
          isDark={isDark}
          disabled
        />

        <ActivityBarIcon
          icon={<Cloud className="w-5 h-5" />}
          label={t("activityBar.cloud")}
          isActive={false}
          onClick={() => handleBottomAction("Cloud Sync")}
          isDark={isDark}
          disabled
        />

        <ActivityBarIcon
          icon={<Github className="w-5 h-5" />}
          label={t("activityBar.github")}
          isActive={false}
          onClick={() => handleBottomAction("GitHub")}
          isDark={isDark}
          disabled
        />

        <ActivityBarIcon
          icon={<Bug className="w-5 h-5" />}
          label={t("activityBar.feedback")}
          isActive={false}
          onClick={() => handleBottomAction("Feedback")}
          isDark={isDark}
          disabled
        />
      </div>
    </aside>
  );
}

interface ActivityBarIconProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isDark: boolean;
  disabled?: boolean;
}

function ActivityBarIcon({ icon, label, isActive, onClick, isDark, disabled = false }: ActivityBarIconProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      disabled={disabled}
      className={`
        w-10 h-10 flex items-center justify-center rounded-md transition-all duration-200
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
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
