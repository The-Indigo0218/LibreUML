import {
  GraduationCap,
  Award,
  CheckCircle2,
  Gamepad2,
  ScrollText,
  BookOpen,
} from "lucide-react";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../../../../../store/uiStore";

export function EduMenuContent() {
  const { t } = useTranslation();
  const openWiki = useUiStore((s) => s.openWiki);

  return (
    <>
      <MenubarItem
        label={t("menubar.edu.wiki")}
        icon={<BookOpen className="w-4 h-4" />}
        onClick={openWiki}
      />

      <div className="h-px bg-surface-border my-1" />

      <div className="px-2 py-1.5 text-xs font-semibold text-text-muted select-none">
        {t("menubar.edu.placeholder")}
      </div>

      <MenubarItem
        label={t("menubar.edu.linter")}
        icon={<CheckCircle2 className="w-4 h-4" />}
        disabled={true}
      />

      <MenubarItem
        label={t("menubar.edu.exam")}
        icon={<GraduationCap className="w-4 h-4" />}
        disabled={true}
      />

      <div className="h-px bg-surface-border my-1" />

      <MenubarItem
        label={t("menubar.edu.achievements")}
        icon={<Award className="w-4 h-4" />}
        disabled={true}
      />

      <MenubarItem
        label={t("menubar.edu.gamification")}
        icon={<Gamepad2 className="w-4 h-4" />}
        disabled={true}
      />

      <MenubarItem
        label={t("menubar.edu.certificates")}
        icon={<ScrollText className="w-4 h-4" />}
        disabled={true}
      />
    </>
  );
}

export function EduMenu() {
  const { t } = useTranslation();
  
  return (
    <MenubarTrigger label={t("menubar.edu.title")}>
      <EduMenuContent />
    </MenubarTrigger>
  );
}