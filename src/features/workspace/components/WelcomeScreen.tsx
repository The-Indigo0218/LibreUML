import { useTranslation } from "react-i18next";
import { FileText, BookOpen, Star, Code } from "lucide-react";

export default function WelcomeScreen() {
  const { t } = useTranslation();

  const handleNewProject = () => {
    console.log("New Project clicked - to be implemented");
  };

  const handleViewDocs = () => {
    window.open("https://github.com/The-Indigo0218/LibreUML#readme", "_blank");
  };

  const handleStarGitHub = () => {
    window.open("https://github.com/The-Indigo0218/LibreUML", "_blank");
  };

  const handleViewSource = () => {
    window.open("https://github.com/The-Indigo0218/LibreUML", "_blank");
  };

  return (
    <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="flex flex-col items-center max-w-2xl px-8 py-12 text-center">
        {/* Logo/Title */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-slate-800 dark:text-slate-100 mb-3">
            {t("welcome.title")}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            {t("welcome.subtitle")}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mt-8">
          <button
            onClick={handleNewProject}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            <FileText size={20} />
            <span className="font-medium">{t("welcome.actions.newProject")}</span>
          </button>

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

          <button
            onClick={handleViewSource}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            <Code size={20} />
            <span className="font-medium">{t("welcome.actions.viewSource")}</span>
          </button>
        </div>

        {/* Footer hint */}
        <p className="mt-12 text-sm text-slate-500 dark:text-slate-500">
          {t("welcome.hint")}
        </p>
      </div>
    </div>
  );
}
