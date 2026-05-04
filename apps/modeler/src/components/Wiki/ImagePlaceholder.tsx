import { Image } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ImagePlaceholderProps {
  cssClass?: string;
  alt?: string;
}

export function ImagePlaceholder({ cssClass, alt }: ImagePlaceholderProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex flex-col items-center justify-center w-full h-[200px] rounded-lg border-2 border-dashed border-surface-border bg-surface-secondary select-none ${cssClass ?? ""}`}
      role="img"
      aria-label={alt ?? t("wiki.image_placeholder")}
    >
      <Image className="w-10 h-10 text-text-muted mb-2" strokeWidth={1.5} />
      <span className="text-xs text-text-muted">{t("wiki.image_placeholder")}</span>
    </div>
  );
}
