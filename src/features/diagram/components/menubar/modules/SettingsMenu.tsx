import { 
  FileType, 
  PlayCircle, 
  SaveAll, 
  Languages, 
  Moon,
  Sun,
  Check,
  Bell
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useSettingsStore } from "../../../../../store/settingsStore";
import ModalPreferencesModal from "../../modals/ModalPreferencesModal"; 

export function SettingsMenuContent() {
  const { t} = useTranslation();
  
  const { 
    autoSave, toggleAutoSave,
    restoreSession, toggleRestoreSession,
    theme, setTheme,
    language, setLanguage
  } = useSettingsStore();

  const [isModalPreferencesOpen, setIsModalPreferencesOpen] = useState(false);

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'es' : 'en';
    setLanguage(newLang); 
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleAssociateFiles = async () => {
    if (window.electronAPI?.isElectron()) {
      const result = await window.electronAPI.associateFiles();
      if (result.success) {
        alert("File association configured!");
      } else {
        alert("Error: " + result.error);
      }
    } else {
      alert("Only available in Desktop App");
    }
  };

  return (
    <>
      <MenubarItem
        label={t("menubar.settings.autoSave") || "Auto Save"}
        icon={
          <div className="relative">
            <SaveAll className="w-4 h-4" />
            {autoSave && <Check className="w-3 h-3 absolute -bottom-1 -right-1 text-green-500 font-bold" />}
          </div>
        }
        onClick={toggleAutoSave}
      />

      <MenubarItem
        label={t("menubar.settings.startup") || "Startup: Restore Session"}
        icon={
           <div className="relative">
            <PlayCircle className="w-4 h-4" />
            {restoreSession && <Check className="w-3 h-3 absolute -bottom-1 -right-1 text-green-500 font-bold" />}
          </div>
        }
        onClick={toggleRestoreSession}
      />

      <div className="h-px bg-surface-border my-1" />

      <MenubarItem
        label={t("menubar.settings.fileAssoc") || "Associate .luml Files"}
        icon={<FileType className="w-4 h-4" />}
        onClick={handleAssociateFiles}
      />

      <MenubarItem
        label={t("menubar.settings.modalPreferences") || "Modal Preferences"}
        icon={<Bell className="w-4 h-4" />}
        onClick={() => setIsModalPreferencesOpen(true)}
      />

      <div className="h-px bg-surface-border my-1" />

      <MenubarItem
        label={`${t("menubar.settings.language")}: ${language.toUpperCase()}`}
        icon={<Languages className="w-4 h-4" />}
        onClick={toggleLanguage}
      />

      <MenubarItem
        label={theme === 'dark' ? "Theme: Dark" : "Theme: Light"}
        icon={theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        onClick={toggleTheme}
      />

      <ModalPreferencesModal
        isOpen={isModalPreferencesOpen}
        onClose={() => setIsModalPreferencesOpen(false)}
      />
    </>
  );
}

export function SettingsMenu() {
  const { t } = useTranslation();

  return (
    <MenubarTrigger label={t("menubar.settings.title") || "Settings"}>
      <SettingsMenuContent />
    </MenubarTrigger>
  );
}