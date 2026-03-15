import { useTranslation } from "react-i18next";
import { FileText, BookOpen, Star, FolderOpen, Lightbulb, PlayCircle } from "lucide-react";
import { useFileLifecycle } from "../../diagram/hooks/actions/useFileLifecycle";

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { createNewDiagram, openDiagramFromDisk } = useFileLifecycle();

  const handleNewProject = () => {
    createNewDiagram();
  };

  const handleOpenProject = () => {
    openDiagramFromDisk();
  };

  const handleViewDocs = () => {
    window.open("https://github.com/The-Indigo0218/LibreUML#readme", "_blank");
  };

  const handleStarGitHub = () => {
    window.open("https://github.com/The-Indigo0218/LibreUML", "_blank");
  };

  return (
    <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="flex flex-col items-center max-w-2xl px-8 py-12 text-center">
        {/* Logo/Title */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex items-center gap-4 mb-3">
            <img 
              src="/logoTitle.svg" 
              alt="LibreUML Logo" 
              className="w-12 h-12"
            />
            <h1 className="text-5xl font-bold text-slate-800 dark:text-slate-100">
              {t("welcome.title")}
            </h1>
          </div>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            {t("welcome.subtitle")}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mt-8">
          {/* Primary Actions */}
          <button
            onClick={handleNewProject}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            <FileText size={20} />
            <span className="font-medium">{t("welcome.actions.newProject")}</span>
          </button>

          <button
            onClick={handleOpenProject}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            <FolderOpen size={20} />
            <span className="font-medium">{t("welcome.actions.openProject")}</span>
          </button>

          {/* Secondary Actions - Disabled for now */}
          <button
            disabled={true}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-lg shadow-md cursor-not-allowed opacity-60"
          >
            <Lightbulb size={20} />
            <span className="font-medium">{t("welcome.actions.viewFeatures")}</span>
          </button>

          <button
            disabled={true}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-lg shadow-md cursor-not-allowed opacity-60"
          >
            <PlayCircle size={20} />
            <span className="font-medium">{t("welcome.actions.getStarted")}</span>
          </button>

          {/* Community Actions */}
          <button
            onClick={handleViewDocs}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            <BookOpen size={20} />
            <span className="font-medium">{t("welcome.actions.viewDocs")}</span>
          </button>

          <button
            onClick={handleStarGitHub}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            <Star size={20} />
            <span className="font-medium">{t("welcome.actions.starGitHub")}</span>
          </button>
        </div>

        {/* Footer hint with interactive links */}
        <p className="mt-12 text-sm text-slate-500 dark:text-slate-500">
          {t("welcome.hintPart1")}{" "}
          <button
            onClick={handleNewProject}
            className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
          >
            {t("welcome.hintAction1")}
          </button>{" "}
          {t("welcome.hintPart2")}{" "}
          <button
            onClick={handleOpenProject}
            className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
          >
            {t("welcome.hintAction2")}
          </button>{" "}
          {t("welcome.hintPart3")}
        </p>
      </div>
    </div>
  );
}
