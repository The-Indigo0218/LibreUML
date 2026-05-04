import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { wikiData, type WikiArticle } from "../../data/wikiData";

export interface WikiArticleContent {
  article: WikiArticle;
  content: {
    title: string;
    definition?: string;
    when?: string;
    example?: string;
    isoRules?: string;
    description?: string;
    howTo?: string[];
    tip?: string;
    imageAlt?: string;
  };
  related: WikiArticle[];
}

export function useWikiArticle(articleId: string | null): WikiArticleContent | null {
  const { t } = useTranslation();

  return useMemo(() => {
    if (!articleId) return null;
    const article = wikiData.find((a) => a.id === articleId);
    if (!article) return null;

    const k = article.i18nKey;
    const related = (article.relatedIds ?? [])
      .map((id) => wikiData.find((a) => a.id === id))
      .filter((a): a is WikiArticle => a !== undefined);

    if (article.category === "uml_concepts") {
      return {
        article,
        content: {
          title: t(`${k}.title`),
          definition: t(`${k}.definition`),
          when: t(`${k}.when`),
          example: t(`${k}.example`),
          isoRules: t(`${k}.iso_rules`),
          imageAlt: t(`${k}.image_alt`),
        },
        related,
      };
    }

    // tool_features
    const rawHowTo = t(`${k}.how_to`, { returnObjects: true });
    const howTo = Array.isArray(rawHowTo) ? (rawHowTo as string[]) : [];

    return {
      article,
      content: {
        title: t(`${k}.title`),
        description: t(`${k}.description`),
        howTo,
        tip: t(`${k}.tip`),
      },
      related,
    };
  }, [articleId, t]);
}
