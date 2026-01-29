import { 
  BookOpen, 
  Bug, 
  Map, 
  Info, 
  Rocket 
} from "lucide-react";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useTranslation } from "react-i18next";

export function HelpMenu() {
  const { t } = useTranslation();
  
  const openDocs = () => window.open("https://github.com/The-Indigo0218/LibreUML#readme", "_blank");
  const reportIssue = () => window.open("https://github.com/The-Indigo0218/LibreUML/issues", "_blank");
  const openRoadmap = () => window.open("https://github.com/The-Indigo0218/LibreUML/blob/main/roadmap.md", "_blank"); 
  
  const showAbout = () => {
    alert("LibreUML v1.0.0\n\nThe Open Source UML Editor for Students.\nDeveloped with ❤️ in React + Electron.");
  };

  return (
    <MenubarTrigger label={t("menubar.help.title")}>
      
      <MenubarItem
        label={t("menubar.help.gettingStarted")}
        icon={<Rocket className="w-4 h-4" />}
        disabled={true} // 🔒 Incoming
      />

      <MenubarItem
        label={t("menubar.help.documentation")}
        icon={<BookOpen className="w-4 h-4" />}
        onClick={openDocs}
      />

      <MenubarItem
        label={t("menubar.help.reportIssue")}
        icon={<Bug className="w-4 h-4" />}
        onClick={reportIssue}
      />

      <div className="h-px bg-surface-border my-1" />

      <MenubarItem
        label={t("menubar.help.roadmap")}
        icon={<Map className="w-4 h-4" />}
        onClick={openRoadmap}
      />

      <MenubarItem
        label={t("menubar.help.about")}
        icon={<Info className="w-4 h-4" />}
        onClick={showAbout}
      />

    </MenubarTrigger>
  );
}