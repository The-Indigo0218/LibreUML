import { 
  GraduationCap, 
  Award, 
  CheckCircle2, 
  Gamepad2, 
  ScrollText 
} from "lucide-react";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";

export function EduMenu() {
  return (
    <MenubarTrigger label="Edu">
      
      <div className="px-2 py-1.5 text-xs font-semibold text-text-muted select-none">
        Learning Tools (Coming Soon)
      </div>

      <MenubarItem
        label="UML Linter (Auto-grade)"
        icon={<CheckCircle2 className="w-4 h-4" />}
        disabled={true} // 🔒 Incoming
      />

      <MenubarItem
        label="Exam Mode"
        icon={<GraduationCap className="w-4 h-4" />}
        disabled={true} // 🔒 Incoming
      />

      <div className="h-px bg-surface-border my-1" />

      <MenubarItem
        label="Achievements"
        icon={<Award className="w-4 h-4" />}
        disabled={true} // 🔒 Incoming
      />

      <MenubarItem
        label="Keyboard Gamification"
        icon={<Gamepad2 className="w-4 h-4" />}
        disabled={true} // 🔒 Incoming
      />

      <MenubarItem
        label="Certificates"
        icon={<ScrollText className="w-4 h-4" />}
        disabled={true} // 🔒 Incoming
      />

    </MenubarTrigger>
  );
}