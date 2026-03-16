import { useState } from "react";
import { FolderOpen, Plus, Github, Star, BookOpen, Play, Clock, Sun, Moon, Globe, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../../store/settingsStore";
import { useThemeSystem } from "../../../hooks/useThemeSystem";
import CreateProjectModal from "../../diagram/components/layout/CreateProjectModal";

interface WelcomeScreenProps {
  onOpenProject?: () => void;
}

export default function WelcomeScreen({ onOpenProject }: WelcomeScreenProps) {
  const { t } = useTranslation();
  const { theme, setTheme, setLanguage, language } = useSettingsStore();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useThemeSystem();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setShowLanguageMenu(false);
  };

  const handleOpenProject = () => {
    onOpenProject?.();
  };

  const handleCreateProject = () => {
    setIsCreateModalOpen(true);
  };

  const handleStarRepo = () => {
    window.open("https://github.com/The-Indigo0218/LibreUML", "_blank");
  };

  const handleOpenDocs = () => {
    window.open("https://github.com/The-Indigo0218/LibreUML#readme", "_blank");
  };

  const handleGetStarted = () => {
    window.open("https://github.com/The-Indigo0218/LibreUML#readme", "_blank");
  };

  const handleOpenGithubProject = () => {
    console.log("Open GitHub project");
  };

  const recentProjects = [
    { name: "E-Commerce System", path: "/projects/ecommerce.luml", lastOpened: "2 hours ago" },
    { name: "Library Management", path: "/projects/library.luml", lastOpened: "Yesterday" },
    { name: "Banking App", path: "/projects/banking.luml", lastOpened: "3 days ago" },
  ];

  const languages = [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ];

  return (
    <div className="h-screen w-screen bg-surface-primary flex flex-col">
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-surface-secondary hover:bg-surface-hover transition-colors"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5 text-text-muted hover:text-text-primary transition-colors" />
          ) : (
            <Moon className="w-5 h-5 text-text-muted hover:text-text-primary transition-colors" />
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className="p-2 rounded-lg bg-surface-secondary hover:bg-surface-hover transition-colors flex items-center gap-1"
            title="Change Language"
          >
            <Globe className="w-5 h-5 text-text-muted hover:text-text-primary transition-colors" />
            <ChevronDown className="w-3 h-3 text-text-muted" />
          </button>

          {showLanguageMenu && (
            <div className="absolute top-full right-0 mt-2 bg-surface-secondary border border-surface-border rounded-lg shadow-lg py-1 min-w-[120px]">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    language === lang.code
                      ? "bg-surface-hover text-text-primary"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          <div className="flex flex-col items-center lg:items-start justify-center space-y-6">
            <img
              src="/logoTitle.svg"
              alt="LibreUML Logo"
              className="w-32 h-32 object-contain drop-shadow-lg"
            />
            <div className="text-center lg:text-left">
              <h1 className="text-5xl font-bold text-text-primary mb-3">
                LibreUML
              </h1>
              <p className="text-lg text-text-secondary max-w-md">
                {t("welcome.subtitle")}
              </p>
            </div>
            <button
              onClick={handleCreateProject}
              className="px-6 py-3 rounded-lg bg-uml-class-border hover:bg-uml-interface-border text-white font-medium transition-colors shadow-lg hover:shadow-xl"
            >
              Create New Project
            </button>
          </div>

          <div className="flex flex-col space-y-8">
            
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
                {t("welcome.recentProjects")}
              </h2>
              <div className="space-y-2">
                {recentProjects.map((project, index) => (
                  <button
                    key={index}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-secondary hover:bg-surface-hover transition-colors text-left group"
                  >
                    <FolderOpen className="w-5 h-5 text-text-muted group-hover:text-uml-class-border transition-colors shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-text-muted truncate">
                        {project.path}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-text-muted shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{project.lastOpened}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
                {t("welcome.startActions")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                <button
                  onClick={handleOpenProject}
                  className="flex items-center gap-3 p-4 rounded-lg bg-surface-secondary hover:bg-uml-class-bg hover:border-uml-class-border border border-surface-border transition-all text-left group"
                >
                  <FolderOpen className="w-5 h-5 text-text-muted group-hover:text-uml-class-border transition-colors shrink-0" />
                  <span className="text-sm font-medium text-text-primary">
                    {t("welcome.openProject")}
                  </span>
                </button>

                <button
                  onClick={handleCreateProject}
                  className="flex items-center gap-3 p-4 rounded-lg bg-surface-secondary hover:bg-uml-class-bg hover:border-uml-class-border border border-surface-border transition-all text-left group"
                >
                  <Plus className="w-5 h-5 text-text-muted group-hover:text-uml-class-border transition-colors shrink-0" />
                  <span className="text-sm font-medium text-text-primary">
                    {t("welcome.createProject")}
                  </span>
                </button>

                <button
                  onClick={handleOpenGithubProject}
                  className="flex items-center gap-3 p-4 rounded-lg bg-surface-secondary hover:bg-surface-hover border border-surface-border transition-all text-left group"
                >
                  <Github className="w-5 h-5 text-text-muted group-hover:text-text-primary transition-colors shrink-0" />
                  <span className="text-sm font-medium text-text-primary">
                    {t("welcome.openGithub")}
                  </span>
                </button>

                <button
                  onClick={handleStarRepo}
                  className="flex items-center gap-3 p-4 rounded-lg bg-surface-secondary hover:bg-surface-hover border border-surface-border transition-all text-left group"
                >
                  <Star className="w-5 h-5 text-text-muted group-hover:text-amber-400 transition-colors shrink-0" />
                  <span className="text-sm font-medium text-text-primary">
                    {t("welcome.starRepo")}
                  </span>
                </button>

                <button
                  onClick={handleOpenDocs}
                  className="flex items-center gap-3 p-4 rounded-lg bg-surface-secondary hover:bg-surface-hover border border-surface-border transition-all text-left group"
                >
                  <BookOpen className="w-5 h-5 text-text-muted group-hover:text-text-primary transition-colors shrink-0" />
                  <span className="text-sm font-medium text-text-primary">
                    {t("welcome.viewDocs")}
                  </span>
                </button>

                <button
                  onClick={handleGetStarted}
                  className="flex items-center gap-3 p-4 rounded-lg bg-surface-secondary hover:bg-surface-hover border border-surface-border transition-all text-left group"
                >
                  <Play className="w-5 h-5 text-text-muted group-hover:text-text-primary transition-colors shrink-0" />
                  <span className="text-sm font-medium text-text-primary">
                    {t("welcome.getStarted")}
                  </span>
                </button>

              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="pb-8 text-center">
        <p className="text-sm text-text-muted">
          {t("welcome.footerPrefix")}{" "}
          <button
            onClick={handleOpenProject}
            className="text-uml-class-border hover:text-uml-interface-border transition-colors underline decoration-dotted underline-offset-2"
          >
            {t("welcome.footerOpenLink")}
          </button>
          {" "}{t("welcome.footerOr")}{" "}
          <button
            onClick={handleCreateProject}
            className="text-uml-class-border hover:text-uml-interface-border transition-colors underline decoration-dotted underline-offset-2"
          >
            {t("welcome.footerCreateLink")}
          </button>
        </p>
      </div>

      <CreateProjectModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}
