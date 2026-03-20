import type { UmlClassNode } from "../../../types/diagram.types";

export type TranslationFunction = (key: string, options?: Record<string, unknown>) => string;

export interface TreeNode {
  name: string;
  fullPath: string;
  children: Map<string, TreeNode>;
  classes: UmlClassNode[];
  isExpanded: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  type: "package" | "class";
  id: string;
  name: string;
  packagePath?: string;
}

export interface DeletePackageState {
  id: string;
  name: string;
  packagePath: string;
  hasClasses: boolean;
  classCount: number;
}

export interface DeletePackageModalProps {
  isOpen: boolean;
  packageName: string;
  hasClasses: boolean;
  classCount: number;
  onConfirm: (deleteClasses: boolean) => void;
  onCancel: () => void;
  isDark: boolean;
  t: TranslationFunction;
}

export interface PackageItemProps {
  node: TreeNode;
  level: number;
  expandedPaths: Set<string>;
  expandedClasses: Set<string>;
  renamingId: string | null;
  addingChildToPath: string | null;
  onToggle: (path: string) => void;
  onClassToggle: (classId: string) => void;
  onClassClick: (nodeId: string) => void;
  onEditClass: (nodeId: string) => void;
  onPackageContextMenu: (e: React.MouseEvent, packagePath: string, packageName: string) => void;
  onClassContextMenu: (e: React.MouseEvent, classId: string, className: string) => void;
  onRenameClass: (classId: string, newName: string) => void;
  onCancelRename: () => void;
  onRenamePackage: (packagePath: string, newName: string) => void;
  onAddChildPackage: (parentPath: string, childName: string) => void;
  onCancelAddChild: () => void;
}

export interface ClassItemProps {
  classNode: UmlClassNode;
  level: number;
  isExpanded: boolean;
  isRenaming: boolean;
  onToggle: (classId: string) => void;
  onClassClick: (nodeId: string) => void;
  onEditClass: (nodeId: string) => void;
  onContextMenu: (e: React.MouseEvent, classId: string, className: string) => void;
  onRename: (classId: string, newName: string) => void;
  onCancelRename: () => void;
}
