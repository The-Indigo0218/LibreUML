import { 
  GraduationCap, 
  Award, 
  CheckCircle2, 
  Gamepad2, 
  ScrollText 
} from "lucide-react";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useTranslation } from "react-i18next";

export function EduMenu() {
  const { t } = useTranslation();
  return (
    <MenubarTrigger label={t("menubar.edu.title")}>
      
      <div className="px-2 py-1.5 text-xs font-semibold text-text-muted select-none">
        Learning Tools (Coming Soon)
      </div>

      <MenubarItem
        label={t("menubar.edu.linter")}
        icon={<CheckCircle2 className="w-4 h-4" />}
        disabled={true} // 🔒 Incoming
      />

      <MenubarItem
        label={t("menubar.edu.exam")}
        icon={<GraduationCap className="w-4 h-4" />}
        disabled={true} // 🔒 Incoming
      />

      <div className="h-px bg-surface-border my-1" />

      <MenubarItem
        label={t("menubar.edu.achievements")}
        icon={<Award className="w-4 h-4" />}
        disabled={true} // 🔒 Incoming
      />

      <MenubarItem
        label={t("menubar.edu.gamification")}
        icon={<Gamepad2 className="w-4 h-4" />}
        disabled={true} // 🔒 Incoming
      />

      <MenubarItem
        label={t("menubar.edu.certificates")}
        icon={<ScrollText className="w-4 h-4" />}
        disabled={true} // 🔒 Incoming
      />

    </MenubarTrigger>
  );
}