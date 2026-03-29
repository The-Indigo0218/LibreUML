import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { wikiData, type WikiArticle } from "../../data/wikiData";

interface CategorySidebarProps {
  selectedArticleId: string | null;
  onSelectArticle: (id: string) => void;
}

interface SubcategoryGroup {
  key: string;
  articles: WikiArticle[];
}

interface CategoryGroup {
  key: string;
  subcategories: SubcategoryGroup[];
}

function buildTree(): CategoryGroup[] {
  const categoryOrder = ["uml_concepts", "tool_features"];
  const subcategoryOrder: Record<string, string[]> = {
    uml_concepts: ["structures", "relations", "annotations"],
    tool_features: ["export", "file_management"],
  };

  return categoryOrder.map((catKey) => {
    const subKeys = subcategoryOrder[catKey] ?? [];
    return {
      key: catKey,
      subcategories: subKeys.map((subKey) => ({
        key: subKey,
        articles: wikiData.filter(
          (a) => a.category === catKey && a.subcategory === subKey
        ),
      })).filter((s) => s.articles.length > 0),
    };
  });
}

const TREE = buildTree();

export function CategorySidebar({ selectedArticleId, onSelectArticle }: CategorySidebarProps) {
  const { t } = useTranslation();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(["uml_concepts", "tool_features"])
  );

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <nav
      className="w-full h-full overflow-y-auto py-3 space-y-1"
      aria-label={t("wiki.sidebar_label")}
    >
      {TREE.map((cat) => {
        const catCount = cat.subcategories.reduce((n, s) => n + s.articles.length, 0);
        const isExpanded = expandedCategories.has(cat.key);

        return (
          <div key={cat.key}>
            {/* Category header */}
            <button
              onClick={() => toggleCategory(cat.key)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded transition-colors"
              aria-expanded={isExpanded}
            >
              <span className="flex items-center gap-1.5">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                )}
                {t(`wiki.categories.${cat.key}`)}
              </span>
              <span className="text-text-muted font-normal normal-case tracking-normal">
                {catCount}
              </span>
            </button>

            {/* Subcategories + articles */}
            {isExpanded && (
              <div className="mt-0.5 mb-1">
                {cat.subcategories.map((sub) => (
                  <div key={sub.key} className="mb-0.5">
                    {/* Subcategory label */}
                    <p className="px-6 py-0.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      {t(`wiki.subcategories.${sub.key}`)}
                    </p>

                    {/* Article items */}
                    {sub.articles.map((article) => {
                      const isSelected = article.id === selectedArticleId;
                      return (
                        <button
                          key={article.id}
                          onClick={() => onSelectArticle(article.id)}
                          className={`w-full text-left px-8 py-1.5 text-sm rounded transition-colors ${
                            isSelected
                              ? "bg-purple-500/15 text-purple-300 font-medium"
                              : "text-text-primary hover:bg-surface-hover"
                          }`}
                        >
                          {t(`${article.i18nKey}.title`)}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
