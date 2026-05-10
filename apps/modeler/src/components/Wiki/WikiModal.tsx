import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SearchBar } from "./SearchBar";
import { CategorySidebar } from "./CategorySidebar";
import { ArticleView } from "./ArticleView";
import { useWikiSearch } from "../../hooks/wiki/useWikiSearch";
import { useWikiArticle } from "../../hooks/wiki/useWikiArticle";
import { wikiData } from "../../data/wikiData";

interface WikiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WikiModal({ isOpen, onClose }: WikiModalProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    () => wikiData[0]?.id ?? null
  );

  const searchResults = useWikiSearch(searchQuery);
  const articleData = useWikiArticle(selectedArticleId);

  // Escape key close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // When search returns results, auto-select first match
  useEffect(() => {
    if (searchQuery.trim() && searchResults.length > 0) {
      setSelectedArticleId(searchResults[0].id);
    }
  }, [searchQuery, searchResults]);

  const handleSelectArticle = useCallback((id: string) => {
    setSelectedArticleId(id);
    setSearchQuery("");
  }, []);

  if (!isOpen) return null;

  const isSearching = searchQuery.trim().length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <BookOpen className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">{t("wiki.title")}</h2>
              <p className="text-xs text-text-muted">ISO 19505 · LibreUML</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-hover rounded-lg transition-colors text-text-muted hover:text-text-primary"
            aria-label={t("wiki.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-56 shrink-0 border-r border-surface-border overflow-hidden">
            <CategorySidebar
              selectedArticleId={selectedArticleId}
              onSelectArticle={handleSelectArticle}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Search bar */}
            <div className="px-4 py-3 border-b border-surface-border shrink-0">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>

            {/* Content area */}
            {isSearching ? (
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-text-muted text-center py-8">
                    {t("wiki.no_results")}
                  </p>
                ) : (
                  searchResults.map((article) => (
                    <button
                      key={article.id}
                      onClick={() => handleSelectArticle(article.id)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors group"
                    >
                      <p className="text-sm font-medium text-text-primary group-hover:text-purple-300 transition-colors">
                        {t(`${article.i18nKey}.title`)}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
                        {t(`wiki.categories.${article.category}`)}
                        {article.subcategory && (
                          <> · {t(`wiki.subcategories.${article.subcategory}`)}</>
                        )}
                      </p>
                    </button>
                  ))
                )}
              </div>
            ) : articleData ? (
              <ArticleView data={articleData} onNavigate={handleSelectArticle} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-text-muted">{t("wiki.select_article")}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="px-5 py-2.5 border-t border-surface-border flex items-center justify-between shrink-0">
          <p className="text-xs text-text-muted">
            {t("wiki.article_count", { count: wikiData.length })}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-surface-secondary hover:bg-surface-hover border border-surface-border rounded-lg transition-colors text-text-primary"
          >
            {t("wiki.close")} <kbd className="ml-1 font-mono opacity-60">Esc</kbd>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
