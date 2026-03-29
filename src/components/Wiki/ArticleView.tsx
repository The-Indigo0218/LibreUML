import { BookOpen, Lightbulb, Code2, Shield, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ImagePlaceholder } from "./ImagePlaceholder";
import { type WikiArticleContent } from "../../hooks/wiki";

interface ArticleViewProps {
  data: WikiArticleContent;
  onNavigate: (articleId: string) => void;
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
        {icon}
        {label}
      </h3>
      <div className="text-sm text-text-primary leading-relaxed pl-1">{children}</div>
    </div>
  );
}

export function ArticleView({ data, onNavigate }: ArticleViewProps) {
  const { t } = useTranslation();
  const { article, content, related } = data;
  const isConceptArticle = article.category === "uml_concepts";

  return (
    <article className="h-full overflow-y-auto px-6 py-5 space-y-5">
      {/* Title */}
      <h2 className="text-xl font-bold text-text-primary">{content.title}</h2>

      {/* Image Placeholder */}
      <ImagePlaceholder
        cssClass={article.imagePlaceholder}
        alt={content.imageAlt}
      />

      {isConceptArticle ? (
        <>
          {/* Definition */}
          {content.definition && (
            <Section
              icon={<BookOpen className="w-3.5 h-3.5 text-blue-400" />}
              label={t("wiki.sections.what")}
            >
              {content.definition}
            </Section>
          )}

          {/* When to use */}
          {content.when && (
            <Section
              icon={<Lightbulb className="w-3.5 h-3.5 text-yellow-400" />}
              label={t("wiki.sections.when")}
            >
              {content.when}
            </Section>
          )}

          {/* Example */}
          {content.example && (
            <Section
              icon={<Code2 className="w-3.5 h-3.5 text-green-400" />}
              label={t("wiki.sections.example")}
            >
              <code className="block bg-surface-secondary border border-surface-border rounded-md px-3 py-2 text-xs font-mono whitespace-pre-wrap">
                {content.example}
              </code>
            </Section>
          )}

          {/* ISO Rules */}
          {content.isoRules && (
            <Section
              icon={<Shield className="w-3.5 h-3.5 text-purple-400" />}
              label={t("wiki.sections.iso_rules")}
            >
              <p className="text-text-muted italic text-xs">{content.isoRules}</p>
            </Section>
          )}
        </>
      ) : (
        <>
          {/* Description */}
          {content.description && (
            <Section
              icon={<BookOpen className="w-3.5 h-3.5 text-blue-400" />}
              label={t("wiki.sections.what_for")}
            >
              {content.description}
            </Section>
          )}

          {/* How to use */}
          {content.howTo && content.howTo.length > 0 && (
            <Section
              icon={<Code2 className="w-3.5 h-3.5 text-green-400" />}
              label={t("wiki.sections.how_to")}
            >
              <ol className="space-y-1.5 list-none">
                {content.howTo.map((step, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-xs flex items-center justify-center font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span dangerouslySetInnerHTML={{ __html: step.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {/* Tip */}
          {content.tip && (
            <div className="flex gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Lightbulb className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-text-primary">{content.tip}</p>
            </div>
          )}
        </>
      )}

      {/* Related articles */}
      {related.length > 0 && (
        <div className="pt-2 border-t border-surface-border space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            {t("wiki.sections.related")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {related.map((rel) => (
              <button
                key={rel.id}
                onClick={() => onNavigate(rel.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-surface-secondary border border-surface-border rounded-full text-text-primary hover:border-purple-500/50 hover:text-purple-300 transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
                {t(`${rel.i18nKey}.title`)}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
