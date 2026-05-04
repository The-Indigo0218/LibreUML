import { useState, useRef, useEffect } from "react";
import {
  FolderOpen, Plus, Github, Star, BookOpen, Play, Clock,
  Sun, Moon, Globe, LogIn, CloudOff, CloudDownload, LayoutGrid,
  ArrowRight, Lock, ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "../../../store/settingsStore";
import { useThemeSystem } from "../../../hooks/useThemeSystem";
import CreateProjectModal from "../../diagram/components/layout/CreateProjectModal";
import { ProjectImportError } from "../../../services/projectIO.service";
import { openLumlFile } from "../../../services/openFileService";
import { useVFSStore } from "../../../store/project-vfs.store";
import { useAuthStore } from "../../../features/auth/store/auth.store";
import { listProjects } from "../../../api/projects.api";
import CloudDiagramPicker from "../../cloud/components/CloudDiagramPicker";
import type { ProjectSummaryResponse } from "../../../api/types";
import type { LibreUMLProject } from "../../../core/domain/vfs/vfs.types";

interface WelcomeScreenProps {
  onOpenProject?: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function getTypeLabel(types: string[]): string {
  if (!types.length) return "UML";
  const map: Record<string, string> = {
    CLASS: "Class", SEQUENCE: "Sequence", USE_CASE: "Use Case",
    ACTIVITY: "Activity", STATE: "State", COMPONENT: "Component",
    DEPLOYMENT: "Deployment", PACKAGE: "Package", OBJECT: "Object",
    UNSPECIFIED: "UML", ER: "ER",
  };
  return map[types[0]] ?? "UML";
}

function getTypeBadgeClass(type: string): string {
  const map: Record<string, string> = {
    CLASS: "bg-violet-900/60 text-violet-300",
    SEQUENCE: "bg-teal-900/60 text-teal-300",
    USE_CASE: "bg-orange-900/60 text-orange-300",
    ACTIVITY: "bg-yellow-900/60 text-yellow-300",
    STATE: "bg-pink-900/60 text-pink-300",
    COMPONENT: "bg-cyan-900/60 text-cyan-300",
    DEPLOYMENT: "bg-indigo-900/60 text-indigo-300",
    PACKAGE: "bg-purple-900/60 text-purple-300",
    OBJECT: "bg-emerald-900/60 text-emerald-300",
  };
  return map[type] ?? "bg-blue-900/60 text-blue-300";
}

function getProjectIconColor(types: string[]): string {
  const map: Record<string, string> = {
    CLASS: "text-violet-400", SEQUENCE: "text-teal-400", USE_CASE: "text-orange-400",
    ACTIVITY: "text-yellow-400", STATE: "text-pink-400", COMPONENT: "text-cyan-400",
    DEPLOYMENT: "text-indigo-400", PACKAGE: "text-purple-400", OBJECT: "text-emerald-400",
  };
  return map[types[0] ?? ""] ?? "text-blue-400";
}

export default function WelcomeScreen({ onOpenProject: _onOpenProject }: WelcomeScreenProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, setTheme, setLanguage, language } = useSettingsStore();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCloudPickerOpen, setIsCloudPickerOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<ProjectSummaryResponse[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const lumlInputRef = useRef<HTMLInputElement>(null);
  const activeProject = useVFSStore((s: { project: LibreUMLProject | null }) => s.project);

  useThemeSystem();

  useEffect(() => {
    if (!isAuthenticated) return;
    setProjectsLoading(true);
    listProjects(0, 4)
      .then((res) => setRecentProjects(res.content))
      .catch(() => setRecentProjects([]))
      .finally(() => setProjectsLoading(false));
  }, [isAuthenticated]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setShowLanguageMenu(false);
  };

  const handleOpenProject = () => {
    if (activeProject) {
      if (!window.confirm(
        "Opening a new project will overwrite your current workspace.\n\nAny unsaved changes will be lost.\n\nDo you want to continue?"
      )) return;
    }
    lumlInputRef.current?.click();
  };

  const handleLumlFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await openLumlFile(file, "standalone");
    } catch (err) {
      if (err instanceof ProjectImportError) {
        alert(`Import failed:\n\n${err.message}`);
      } else {
        alert("Import failed: an unexpected error occurred.");
        console.error("[LibreUML] Project import error:", err);
      }
    }
    event.target.value = "";
  };

  const handleOpenFromCloud = () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    setIsCloudPickerOpen(true);
  };

  const handleStarRepo = () => window.open("https://github.com/The-Indigo0218/LibreUML", "_blank", "noopener,noreferrer");
  const handleOpenDocs = () => window.open("https://github.com/The-Indigo0218/LibreUML#readme", "_blank", "noopener,noreferrer");
  const handleGetStarted = () => window.open("https://github.com/The-Indigo0218/LibreUML#readme", "_blank", "noopener,noreferrer");
  const handleOpenGithubProject = () => window.open("https://github.com/The-Indigo0218/LibreUML", "_blank", "noopener,noreferrer");

  const languages = [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ];

  return (
    <div className="h-screen w-screen bg-surface-primary flex flex-col overflow-hidden">
      <input
        type="file"
        ref={lumlInputRef}
        onChange={handleLumlFileSelected}
        accept=".luml.zip,.luml"
        style={{ display: "none" }}
        aria-label="Open LibreUML project"
      />

      {/* ── TOP BANNER ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-surface-border/60 shrink-0">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <CloudOff className="w-4 h-4 shrink-0" />
          {isAuthenticated ? (
            <span>{t("welcome.cloudSynced")}</span>
          ) : (
            <>
              <span className="font-medium text-text-secondary">{t("welcome.cloudSync")}</span>
              <span className="text-text-muted/40 select-none">—</span>
              <span>{t("welcome.cloudFree")}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Theme */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark"
              ? <Sun className="w-4 h-4 text-text-muted" />
              : <Moon className="w-4 h-4 text-text-muted" />}
          </button>

          {/* Language */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
              title="Change Language"
            >
              <Globe className="w-4 h-4 text-text-muted" />
            </button>
            {showLanguageMenu && (
              <div className="absolute top-full right-0 mt-1 bg-surface-secondary border border-surface-border rounded-lg shadow-xl py-1 min-w-[130px] z-30">
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

          {!isAuthenticated && (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-colors ml-2"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              {t("auth.welcomeCta.loginButton")}
            </button>
          )}
        </div>
      </div>

      {/* ── BODY ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT SIDEBAR — 30% */}
        <div className="w-[30%] shrink-0 flex flex-col items-start justify-center px-12 py-10 border-r border-surface-border/40">
          <img
            src="/logoTitle.svg"
            alt="LibreUML Logo"
            className="w-14 h-14 object-contain"
          />
          <h1 className="text-4xl font-bold text-text-primary mt-5 mb-2 tracking-tight">
            LibreUML
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-[280px]">
            {t("welcome.subtitle")}
          </p>
          <div className="flex items-center gap-2 mb-8">
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-surface-secondary text-text-muted border border-surface-border">
              v1.0.0
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-900/40 text-emerald-400 border border-emerald-800/50">
              {t("welcome.openSource")}
            </span>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-900/30"
          >
            <Plus className="w-4 h-4" />
            {t("welcome.createNewProject")}
          </button>
        </div>

        {/* GAP — ~5% natural breathing room, content takes 60% */}
        <div className="w-[5%] shrink-0" />

        {/* MAIN CONTENT — 60% */}
        <div className="w-[60%] overflow-y-auto py-8 pr-4">

          {/* RECENT PROJECTS */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                {t("welcome.recentProjects")}
              </h2>
              {isAuthenticated && recentProjects.length > 0 && (
                <button
                  onClick={() => setIsCloudPickerOpen(true)}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  {t("welcome.viewAll")}
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {!isAuthenticated ? (
              <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-surface-secondary border border-surface-border/60">
                <Lock className="w-4 h-4 text-text-muted/50 shrink-0" />
                <p className="text-sm text-text-muted flex-1">
                  {t("welcome.loginToSee")}
                </p>
                <button
                  onClick={() => navigate("/login")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-medium text-white transition-colors shrink-0"
                >
                  <LogIn className="w-3 h-3" />
                  {t("welcome.loginNow")}
                </button>
              </div>
            ) : projectsLoading ? (
              <div className="space-y-px border border-surface-border/60 rounded-xl overflow-hidden">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 bg-surface-secondary animate-pulse" />
                ))}
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="px-4 py-5 rounded-xl bg-surface-secondary border border-surface-border/60 text-sm text-text-muted text-center">
                {t("welcome.noRecentProjects")}
              </div>
            ) : (
              <div className="border border-surface-border/60 rounded-xl overflow-hidden divide-y divide-surface-border/40">
                {recentProjects.map((project) => {
                  const primaryType = project.diagramTypes[0] ?? "UNSPECIFIED";
                  return (
                    <button
                      key={project.id}
                      onClick={() => setIsCloudPickerOpen(true)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-surface-secondary hover:bg-surface-hover transition-colors text-left group"
                    >
                      <div className="p-1.5 rounded-lg bg-surface-primary shrink-0">
                        <FolderOpen className={`w-4 h-4 ${getProjectIconColor(project.diagramTypes)}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {project.name}
                        </p>
                        <p className="text-xs text-text-muted truncate font-mono">
                          {project.description ?? `/projects/${project.name.toLowerCase().replace(/\s+/g, "-")}.luml`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeClass(primaryType)}`}>
                          {getTypeLabel(project.diagramTypes)}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-text-muted">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeAgo(project.updatedAt)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ACTIONS */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">
              {t("welcome.actions")}
            </h2>

            {/* 2×2 main grid */}
            <div className="grid grid-cols-2 gap-3 mb-3">

              {/* Create project */}
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-4 p-5 rounded-xl bg-violet-600 hover:bg-violet-500 transition-all text-left shadow-md shadow-violet-900/30 hover:shadow-violet-800/40"
              >
                <div className="p-2 rounded-lg bg-white/20 shrink-0">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{t("welcome.createProject")}</p>
                  <p className="text-xs text-violet-200 mt-0.5">{t("welcome.createProjectSub")}</p>
                </div>
              </button>

              {/* Open from cloud */}
              <button
                onClick={handleOpenFromCloud}
                className="flex items-center gap-4 p-5 rounded-xl bg-surface-secondary hover:bg-surface-hover border border-surface-border/60 transition-all text-left"
              >
                <div className="p-2 rounded-lg bg-teal-900/50 shrink-0">
                  <CloudDownload className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">{t("welcome.openFromCloud")}</p>
                  <p className="text-xs text-text-muted mt-0.5">{t("welcome.openFromCloudSub")}</p>
                </div>
              </button>

              {/* Star repo */}
              <button
                onClick={handleStarRepo}
                className="flex items-center gap-4 p-5 rounded-xl bg-surface-secondary hover:bg-surface-hover border border-surface-border/60 transition-all text-left"
              >
                <div className="p-2 rounded-lg bg-amber-900/50 shrink-0">
                  <Star className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">{t("welcome.starRepo")}</p>
                  <p className="text-xs text-text-muted mt-0.5">{t("welcome.starRepoSub")}</p>
                </div>
              </button>

              {/* More options — toggle */}
              <button
                onClick={() => setShowMoreOptions((v) => !v)}
                className={`flex items-center justify-center gap-3 p-5 rounded-xl border transition-all ${
                  showMoreOptions
                    ? "bg-violet-900/20 border-violet-600/50 text-violet-300"
                    : "bg-surface-secondary hover:bg-surface-hover border-surface-border/60 text-text-primary"
                }`}
              >
                <LayoutGrid className="w-6 h-6 text-violet-400" />
                <span className="text-sm font-bold">{t("welcome.moreOptions")}</span>
                <ChevronDown
                  className={`w-4 h-4 text-text-muted transition-transform duration-300 ${showMoreOptions ? "rotate-180" : ""}`}
                />
              </button>

            </div>

            {/* Collapsible — bottom 4 actions */}
            <div
              className={`grid grid-cols-4 gap-3 overflow-hidden transition-all duration-300 ease-in-out ${
                showMoreOptions ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <button
                onClick={handleOpenProject}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-secondary hover:bg-surface-hover border border-surface-border/60 transition-all text-center group"
              >
                <FolderOpen className="w-5 h-5 text-text-muted group-hover:text-text-primary transition-colors" />
                <div>
                  <p className="text-xs font-semibold text-text-primary">{t("welcome.openProject")}</p>
                  <p className="text-xs text-text-muted leading-tight mt-0.5">{t("welcome.openProjectSub")}</p>
                </div>
              </button>

              <button
                onClick={handleOpenDocs}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-secondary hover:bg-surface-hover border border-surface-border/60 transition-all text-center group"
              >
                <BookOpen className="w-5 h-5 text-text-muted group-hover:text-text-primary transition-colors" />
                <div>
                  <p className="text-xs font-semibold text-text-primary">{t("welcome.viewDocs")}</p>
                  <p className="text-xs text-text-muted leading-tight mt-0.5">{t("welcome.viewDocsSub")}</p>
                </div>
              </button>

              <button
                onClick={handleOpenGithubProject}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-secondary hover:bg-surface-hover border border-surface-border/60 transition-all text-center group"
              >
                <Github className="w-5 h-5 text-text-muted group-hover:text-text-primary transition-colors" />
                <div>
                  <p className="text-xs font-semibold text-text-primary">{t("welcome.openGithub")}</p>
                  <p className="text-xs text-text-muted leading-tight mt-0.5">{t("welcome.openGithubSub")}</p>
                </div>
              </button>

              <button
                onClick={handleGetStarted}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-secondary hover:bg-surface-hover border border-surface-border/60 transition-all text-center group"
              >
                <Play className="w-5 h-5 text-text-muted group-hover:text-text-primary transition-colors" />
                <div>
                  <p className="text-xs font-semibold text-text-primary">{t("welcome.getStarted")}</p>
                  <p className="text-xs text-text-muted leading-tight mt-0.5">{t("welcome.getStartedSub")}</p>
                </div>
              </button>
            </div>

          </div>
        </div>

        {/* RIGHT BREATHING ROOM — 5% */}
        <div className="w-[5%] shrink-0" />

      </div>

      <CreateProjectModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      <CloudDiagramPicker isOpen={isCloudPickerOpen} onClose={() => setIsCloudPickerOpen(false)} />
    </div>
  );
}
