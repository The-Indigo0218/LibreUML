import { FolderOpen, Plus, Github, Star, BookOpen, Play, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface WelcomeScreenProps {
  onOpenProject?: () => void;
  onCreateProject?: () => void;
}

export default function WelcomeScreen({ onOpenProject, onCreateProject }: WelcomeScreenProps) {
  const { t } = useTranslation();

  const handleOpenProject = () => {
    onOpenProject?.();
  };

  const handleCreateProject = () => {
    onCreateProject?.();
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

  return (
    <div className="h-full w-full bg-surface-primary flex items-center justify-center p-8">
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

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
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
    </div>
  );
}
