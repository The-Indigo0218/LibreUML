import { FolderTree, Package, Wrench, UserCircle, Cloud, Github, Bug, MonitorPlay } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../../../../store/uiStore";
import { useLayoutStore } from "../../../../store/layout.store";

export type ActivityTab = "structure" | "packages" | "tools" | "profile" | "cloud" | "github" | null;

interface ActivityBarProps {
  activeTab: ActivityTab;
  onTabChange: (tab: ActivityTab) => void;
}

export default function ActivityBar({ activeTab, onTabChange }: ActivityBarProps) {
  const { t } = useTranslation();
  const toggleGetStarted = useUiStore((s) => s.toggleGetStarted);
  const isGetStartedOpen = useUiStore((s) => s.isGetStartedOpen);
  const { isLeftPanelOpen, toggleLeftPanel } = useLayoutStore();

  const handleTabClick = (tab: ActivityTab) => {
    // Si se hace click en el mismo tab que está activo, cerrar el panel
    if (activeTab === tab) {
      onTabChange(null);
      if (isLeftPanelOpen) {
        toggleLeftPanel();
      }
    } else {
      // Si se hace click en un tab diferente
      onTabChange(tab);
      // Si el panel está cerrado, abrirlo
      if (!isLeftPanelOpen) {
        toggleLeftPanel();
      }
    }
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

      <button
        onClick={toggleGetStarted}
        title={t("activityBar.getStarted")}
        className={`mt-auto w-10 h-10 flex items-center justify-center rounded-md transition-all duration-200 ${
          isGetStartedOpen
            ? "text-purple-400 bg-purple-500/10"
            : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
        }`}
      >
        <MonitorPlay className="w-5 h-5" />
      </button>

      <a
        href="https://forms.gle/GBTnWcmEMV1EryMZ8"
        target="_blank"
        rel="noopener noreferrer"
        title="Report Bug"
        className="w-10 h-10 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all duration-200"
      >
        <Bug className="w-5 h-5" />
      </a>
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
