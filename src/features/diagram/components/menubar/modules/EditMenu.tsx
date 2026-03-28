import { 
  Undo2, 
  Redo2, 
  Copy, 
  Trash2, 
  CheckSquare, 
  Pencil
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useEditActions } from "../../../hooks/actions/useEditActions";

export function EditMenu() {
  const { t } = useTranslation();
  
  // Connect to the Logic Hook
  const {
    undo,
    redo,
    selectAll,
    duplicateSelected,
    deleteSelected,
    editSelected,
  } = useEditActions();

  return (
    <MenubarTrigger label={t("menubar.edit.title") || "Edit"}>
      
      {/* --- HISTORY --- */}
      <MenubarItem
        label={t("menubar.edit.undo") || "Undo"}
        icon={<Undo2 className="w-4 h-4" />}
        shortcut="Ctrl+Z"
        onClick={undo}
      />
      <MenubarItem
        label={t("menubar.edit.redo") || "Redo"}
        icon={<Redo2 className="w-4 h-4" />}
        shortcut="Ctrl+Y"
        onClick={redo}
      />

      <div className="h-px bg-surface-border my-1" />

      {/* --- MANIPULATION --- */}
      <MenubarItem
        label={t("menubar.edit.duplicate") || "Duplicate"}
        icon={<Copy className="w-4 h-4" />}
        shortcut="Ctrl+D"
        onClick={duplicateSelected}
      />

      <MenubarItem
        label={t("menubar.edit.edit") || "Edit Properties"}
        icon={<Pencil className="w-4 h-4" />}
        shortcut="Enter"
        onClick={editSelected}
      />

      <MenubarItem
        label={t("menubar.edit.delete") || "Delete"}
        icon={<Trash2 className="w-4 h-4" />}
        shortcut="Supr"
        danger
        onClick={deleteSelected}
      />

      <div className="h-px bg-surface-border my-1" />

      {/* --- SELECTION --- */}
      <MenubarItem
        label={t("menubar.edit.selectAll") || "Select All"}
        icon={<CheckSquare className="w-4 h-4" />}
        shortcut="Ctrl+A"
        onClick={selectAll}
      />

    </MenubarTrigger>
  );
}