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
import { useTranslation } from "react-i18next";
import { MenubarTrigger } from "../../../../../components/ui/menubar/MenubarTrigger";
import { MenubarItem } from "../../../../../components/ui/menubar/MenubarItem";
import { useSpotlightStore } from "../../../hooks/useSpotlight";
import { useSettingsStore } from "../../../../../store/settingsStore";
import { useKonvaAutoLayout } from "../../../../../canvas/hooks/useKonvaAutoLayout";
import { useViewportControlStore } from "../../../../../canvas/store/viewportControlStore";

export function ViewMenuContent() {
  const { t } = useTranslation();

  const zoomIn = useViewportControlStore((s) => s.zoomIn);
  const zoomOut = useViewportControlStore((s) => s.zoomOut);
  const fitView = useViewportControlStore((s) => s.fitView);

  const showMiniMap = useSettingsStore((s) => s.showMiniMap);
  const toggleMiniMap = useSettingsStore((s) => s.toggleMiniMap);
  const showGrid = useSettingsStore((s) => s.showGrid);
  const toggleGrid = useSettingsStore((s) => s.toggleGrid);
  const snapToGrid = useSettingsStore((s) => s.snapToGrid);
  const toggleSnapToGrid = useSettingsStore((s) => s.toggleSnapToGrid);
  const showAllEdges = useSettingsStore((s) => s.showAllEdges);
  const toggleShowAllEdges = useSettingsStore((s) => s.toggleShowAllEdges);

  const { runLayout } = useKonvaAutoLayout();

  const toggleSpotlight = useSpotlightStore((s) => s.toggle);

  return (
    <>
      <MenubarItem
        label={t("menubar.view.zoomIn") || "Zoom In"}
        icon={<ZoomIn className="w-4 h-4" />}
        shortcut="Ctrl + +"
        onClick={() => zoomIn()}
      />
      <MenubarItem
        label={t("menubar.view.zoomOut") || "Zoom Out"}
        icon={<ZoomOut className="w-4 h-4" />}
        shortcut="Ctrl + -"
        onClick={() => zoomOut()}
      />
      <MenubarItem
        label={t("menubar.view.fitView") || "Fit View"}
        icon={<Maximize className="w-4 h-4" />}
        shortcut="Space"
        onClick={() => fitView()}
      />

      <div className="h-px bg-surface-border my-1" />

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
        onClick={runLayout}
      />
    </>
  );
}

export function ViewMenu() {
  const { t } = useTranslation();

  return (
    <MenubarTrigger label={t("menubar.view.title") || "View"}>
      <ViewMenuContent />
    </MenubarTrigger>
  );
}
