import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Map, 
  Search,
  Check,
  Grid3X3,
  Magnet,
  Network,
  Wand2
} from "lucide-react";
import { useReactFlow } from "reactflow";
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useSpotlightStore } from "../../../hooks/useSpotlight";

/**
 * TODO: SSOT Migration - View Settings
 * 
 * View settings (minimap, grid, snap, showAllEdges) should be stored in:
 * - WorkspaceStore per-file metadata for file-specific settings
 * - SettingsStore for global preferences
 * 
 * For now, using hardcoded defaults to prevent build errors.
 */
export function ViewMenu() {
  const { t } = useTranslation();
  
  // React Flow Controls
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  // TODO: SSOT - These should come from WorkspaceStore/SettingsStore
  const showMiniMap = false;
  const toggleMiniMap = () => console.warn("TODO: SSOT - toggleMiniMap not implemented");
  const showAllEdges = true;
  const toggleShowAllEdges = () => console.warn("TODO: SSOT - toggleShowAllEdges not implemented");
  const applyAutoLayout = (direction: string) => console.warn("TODO: SSOT - applyAutoLayout not implemented", direction);
  const showGrid = false;
  const toggleGrid = () => console.warn("TODO: SSOT - toggleGrid not implemented");
  const snapToGrid = false;
  const toggleSnapToGrid = () => console.warn("TODO: SSOT - toggleSnapToGrid not implemented");

  const toggleSpotlight = useSpotlightStore((s) => s.toggle);

  return (
    <MenubarTrigger label={t("menubar.view.title") || "View"}>
      
      {/* --- ZOOM CONTROLS --- */}
      <MenubarItem
        label={t("menubar.view.zoomIn") || "Zoom In"}
        icon={<ZoomIn className="w-4 h-4" />}
        shortcut="Ctrl + +"
        onClick={() => zoomIn({ duration: 300 })}
      />
      <MenubarItem
        label={t("menubar.view.zoomOut") || "Zoom Out"}
        icon={<ZoomOut className="w-4 h-4" />}
        shortcut="Ctrl + -"
        onClick={() => zoomOut({ duration: 300 })}
      />
      <MenubarItem
        label={t("menubar.view.fitView") || "Fit View"}
        icon={<Maximize className="w-4 h-4" />}
        shortcut="Space"
        onClick={() => fitView({ duration: 800 })}
      />

      <div className="h-px bg-surface-border my-1" />

      {/* --- VISUAL AIDS --- */}
      <MenubarItem
        label={t("menubar.view.minimap") || "Show Minimap"}
        icon={
          <div className="relative">
            <Map className="w-4 h-4" />
            {showMiniMap && <Check className="w-3 h-3 absolute -bottom-1 -right-1 text-green-500 font-bold" />}
          </div>
        }
        onClick={toggleMiniMap}
      />

      <MenubarItem
        label={t("menubar.view.grid") || "Show Grid"}
        icon={
          <div className="relative">
            <Grid3X3 className="w-4 h-4" />
            {showGrid && <Check className="w-3 h-3 absolute -bottom-1 -right-1 text-green-500 font-bold" />}
          </div>
        }
        onClick={toggleGrid}
      />

       <MenubarItem
        label={t("menubar.view.snap") || "Snap to Grid"}
        icon={
          <div className="relative">
            <Magnet className="w-4 h-4" />
            {snapToGrid && <Check className="w-3 h-3 absolute -bottom-1 -right-1 text-green-500 font-bold" />}
          </div>
        }
        onClick={toggleSnapToGrid}
      />
      <MenubarItem
        label={t("menubar.view.connections") || "Highlight Connections"}
        icon={
          <div className="relative">
            <Network className="w-4 h-4" />
            {showAllEdges && <Check className="w-3 h-3 absolute -bottom-1 -right-1 text-green-500 font-bold" />}
          </div>
        }
        onClick={toggleShowAllEdges}
      />

      <div className="h-px bg-surface-border my-1" />

      {/* --- TOOLS --- */}
      <MenubarItem
        label={t("menubar.view.spotlight") || "Spotlight Search"}
        icon={<Search className="w-4 h-4" />}
        shortcut="Ctrl + K"
        onClick={toggleSpotlight}
      />

      <MenubarItem
        label={t("menubar.view.magicLayout") || "Magic Layout"}
        icon={<Wand2 className="w-4 h-4 text-purple-400" />}
        shortcut="Ctrl + L"
        onClick={() => applyAutoLayout("TB")}
      />

    </MenubarTrigger>
  );
}
