export interface PackageItemProps {
  pkg: { id: string; name: string; parentId?: string };
  nodes: any[];
  childPackages: any[];
  allPackages: any[];
  allNodes: any[];
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onStartEdit: (id: string, name: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onAddSubPackage: (parentId: string) => void;
  onClassClick: (nodeId: string) => void;
  isDark: boolean;
  t: any;
  level: number;
}

export interface ClassItemProps {
  node: any;
  onClassClick: (nodeId: string) => void;
  isDark: boolean;
}

export interface DeleteConfirmation {
  id: string;
  name: string;
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
  t: any;
}
