import { 
  FileType, 
  PlayCircle, 
  SaveAll, 
  Languages, 
  Moon 
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";

export function SettingsMenu() {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'es' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <MenubarTrigger label={t("menubar.settings.title") || "Settings"}>
      
      {/* --- GENERAL PREFERENCES --- */}
      
      {/* Auto Save Toggle */}
      <MenubarItem
        label={t("menubar.settings.autoSave") || "Auto Save"}
        icon={<SaveAll className="w-4 h-4" />}
        disabled // Logic incoming
      />

      {/* Startup Behavior */}
      <MenubarItem
        label={t("menubar.settings.startup") || "Startup: Restore Session"}
        icon={<PlayCircle className="w-4 h-4" />}
        disabled // Logic incoming
      />

      <div className="h-px bg-surface-border my-1" />

      {/* --- SYSTEM INTEGRATION --- */}

      {/* File Association */}
      <MenubarItem
        label={t("menubar.settings.fileAssoc") || "Associate .luml Files"}
        icon={<FileType className="w-4 h-4" />}
        disabled 
      />

      <div className="h-px bg-surface-border my-1" />

      {/* --- APPEARANCE & LOCALIZATION --- */}

      {/* Language Switcher */}
      <MenubarItem
        label={`${t("menubar.settings.language")}: ${i18n.language.toUpperCase()}`}
        icon={<Languages className="w-4 h-4" />}
        onClick={toggleLanguage}
      />

      {/* Theme Toggle (Placeholder) */}
      <MenubarItem
        label={t("menubar.settings.theme") || "Theme"}
        icon={<Moon className="w-4 h-4" />}
        disabled
      />
    </MenubarTrigger>
  );
}