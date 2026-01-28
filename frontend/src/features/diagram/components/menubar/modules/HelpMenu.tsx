import { 
  BookOpen, 
  Bug, 
  Map, 
  Info, 
  Rocket 
} from "lucide-react";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";

export function HelpMenu() {
  
  const openDocs = () => window.open("https://github.com/tu-usuario/LibreUML#readme", "_blank");
  const reportIssue = () => window.open("https://github.com/tu-usuario/LibreUML/issues", "_blank");
  const openRoadmap = () => window.open("https://github.com/users/tu-usuario/projects/1", "_blank"); 
  
  const showAbout = () => {
    alert("LibreUML v1.0.0\n\nThe Open Source UML Editor for Students.\nDeveloped with ❤️ in React + Electron.");
  };

  return (
    <MenubarTrigger label="Help">
      
      <MenubarItem
        label="Getting Started"
        icon={<Rocket className="w-4 h-4" />}
        disabled={true} // 🔒 Incoming
      />

      <MenubarItem
        label="Documentation"
        icon={<BookOpen className="w-4 h-4" />}
        onClick={openDocs}
      />

      <MenubarItem
        label="Report Issue"
        icon={<Bug className="w-4 h-4" />}
        onClick={reportIssue}
      />

      <div className="h-px bg-surface-border my-1" />

      <MenubarItem
        label="Roadmap"
        icon={<Map className="w-4 h-4" />}
        onClick={openRoadmap}
      />

      <MenubarItem
        label="About LibreUML"
        icon={<Info className="w-4 h-4" />}
        onClick={showAbout}
      />

    </MenubarTrigger>
  );
}