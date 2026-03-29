import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { wikiData, type WikiArticle } from "../../data/wikiData";

export function useWikiSearch(query: string, categoryFilter?: string): WikiArticle[] {
  const { t } = useTranslation();

  return useMemo(() => {
    let pool = categoryFilter
      ? wikiData.filter((a) => a.category === categoryFilter || a.subcategory === categoryFilter)
      : wikiData;

    if (!query.trim()) return pool;

    const q = query.trim().toLowerCase();

    const scored = pool.map((article) => {
      const title = t(`${article.i18nKey}.title`, { defaultValue: "" }).toLowerCase();
      const definition = t(`${article.i18nKey}.definition`, { defaultValue: "" }).toLowerCase();
      const description = t(`${article.i18nKey}.description`, { defaultValue: "" }).toLowerCase();
      const searchable = `${title} ${definition} ${description}`;

      let score = 0;
      if (title === q) score = 3;
      else if (title.startsWith(q)) score = 2;
      else if (searchable.includes(q)) score = 1;

      return { article, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.article);
  }, [query, categoryFilter, t]);
}
