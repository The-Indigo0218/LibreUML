import { FolderTree, Package, Wrench, UserCircle, Cloud, Github, Bug } from "lucide-react";
import { useTranslation } from "react-i18next";

export type ActivityTab = "structure" | "packages" | "tools" | "profile" | "cloud" | "github" | "bug" | null;

interface ActivityBarProps {
  activeTab: ActivityTab;
  onTabChange: (tab: ActivityTab) => void;
}

export default function ActivityBar({ activeTab, onTabChange }: ActivityBarProps) {
  const { t } = useTranslation();

  const handleTabClick = (tab: ActivityTab) => {
    onTabChange(activeTab === tab ? null : tab);
  };

  return (
    <aside className="w-12 border-r border-surface-border bg-surface-primary flex flex-col items-center py-2 gap-1 z-20">
      <ActivityBarIcon
        icon={<FolderTree className="w-5 h-5" />}
        label={t('activityBar.projectStructure')}
        isActive={activeTab === "structure"}
        onClick={() => handleTabClick("structure")}
      />
      
      <ActivityBarIcon
        icon={<Package className="w-5 h-5" />}
        label={t('activityBar.packageExplorer')}
        isActive={activeTab === "packages"}
        onClick={() => handleTabClick("packages")}
      />

      <ActivityBarIcon
        icon={<Wrench className="w-5 h-5" />}
        label={t('activityBar.modelingTools')}
        isActive={activeTab === "tools"}
        onClick={() => handleTabClick("tools")}
      />

      <ActivityBarIcon
        icon={<UserCircle className="w-5 h-5" />}
        label={t('activityBar.userProfile')}
        isActive={activeTab === "profile"}
        onClick={() => handleTabClick("profile")}
      />

      <ActivityBarIcon
        icon={<Cloud className="w-5 h-5" />}
        label={t('activityBar.cloudSync')}
        isActive={activeTab === "cloud"}
        onClick={() => handleTabClick("cloud")}
      />

      <ActivityBarIcon
        icon={<Github className="w-5 h-5" />}
        label={t('activityBar.githubIntegration')}
        isActive={activeTab === "github"}
        onClick={() => handleTabClick("github")}
      />

      <ActivityBarIcon
        icon={<Bug className="w-5 h-5" />}
        label={t('activityBar.bugReport')}
        isActive={activeTab === "bug"}
        onClick={() => handleTabClick("bug")}
      />
    </aside>
  );
}

interface ActivityBarIconProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function ActivityBarIcon({ icon, label, isActive, onClick }: ActivityBarIconProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`
        w-10 h-10 flex items-center justify-center rounded-md transition-all duration-200
        ${isActive 
          ? 'bg-surface-hover text-text-primary border-l-2 border-blue-500' 
          : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
        }
      `}
    >
      {icon}
    </button>
  );
}
