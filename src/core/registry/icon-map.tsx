import {
  Box,
  CircleDot,
  BoxSelect,
  StickyNote,
  List,
  ArrowUpRight,
  GitCommitHorizontal,
  ArrowUp,
  MoveRight,
  Diamond,
  User,
  Circle,
  Square,
  ArrowRight,
  FileCode,
  Package,
  Upload,
  Image as ImageIcon,
  FileCode2,
} from "lucide-react";

/**
 * Icon mapping for dynamic icon rendering
 * Maps icon names (strings) to Lucide React components
 */
export const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Box,
  CircleDot,
  BoxSelect,
  StickyNote,
  List,
  ArrowUpRight,
  GitCommitHorizontal,
  ArrowUp,
  MoveRight,
  Diamond,
  User,
  Circle,
  Square,
  ArrowRight,
  FileCode,
  Package,
  Upload,
  ImageIcon,
  FileCode2,
};

/**
 * Get icon component by name
 */
export function getIconComponent(iconName: string): React.ComponentType<{ className?: string }> | null {
  return iconMap[iconName] || null;
}
