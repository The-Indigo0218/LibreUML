import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useReactFlow } from "reactflow";
import { useDiagramStore } from "../../../../store/diagramStore";
import { useSettingsStore } from "../../../../store/settingsStore";
import { PackageItem } from "./packageExplorer/PackageItem";
import { UnassignedClasses } from "./packageExplorer/UnassignedClasses";
import { DeletePackageModal } from "./packageExplorer/DeletePackageModal";
import type { DeleteConfirmation } from "./packageExplorer/types";

export default function PackageExplorer() {
  const { packages, nodes, addPackage, updatePackageName, deletePackage } = useDiagramStore();
  const theme = useSettingsStore((state) => state.theme);
  const { t } = useTranslation();
  const reactFlowInstance = useReactFlow();
  
  const [newPackageName, setNewPackageName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addingParentId, setAddingParentId] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);

  const isDark = theme === "dark";
  const rootPackages = packages.filter(pkg => !pkg.parentId);
  const getChildPackages = (parentId: string) => packages.filter(pkg => pkg.parentId === parentId);

  const handleAddPackage = () => {
    if (newPackageName.trim()) {
      addPackage(newPackageName.trim(), addingParentId);
      setNewPackageName("");
      setIsAdding(false);
      setAddingParentId(undefined);
    }
  };

  const handleStartAddSubPackage = (parentId: string) => {
    setAddingParentId(parentId);
    setIsAdding(true);
  };

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      updatePackageName(editingId, editingName.trim());
      setEditingId(null);
      setEditingName("");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const getAllPackageNames = (pkgId: string): string[] => {
    const pkg = packages.find(p => p.id === pkgId);
    if (!pkg) return [];
    
    const childPackages = packages.filter(p => p.parentId === pkgId);
    const childNames = childPackages.flatMap(child => getAllPackageNames(child.id));
    
    return [pkg.name, ...childNames];
  };

  const handleDeleteClick = (id: string, name: string) => {
    const packageNames = getAllPackageNames(id);
    const classesInPackage = nodes.filter((n) => 
      n.data.package && packageNames.includes(n.data.package)
    );

    setDeleteConfirmation({ 
      id, 
      name, 
      hasClasses: classesInPackage.length > 0,
      classCount: classesInPackage.length
    });
  };

  const handleConfirmDelete = (deleteClasses: boolean) => {
    if (deleteConfirmation) {
      deletePackage(deleteConfirmation.id, deleteClasses);
      setDeleteConfirmation(null);
    }
  };

  const handleClassClick = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node && reactFlowInstance) {
      reactFlowInstance.setCenter(
        node.position.x + (node.width || 200) / 2,
        node.position.y + (node.height || 100) / 2,
        { zoom: 1.2, duration: 800 }
      );
    }
  };

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-[#252526] text-[#cccccc]' : 'bg-[#f3f3f3] text-[#383838]'}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-[#2d2d2d]' : 'border-[#e0e0e0]'}`}>
        <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-[#cccccc]' : 'text-[#616161]'}`}>
          {t("sidebar.explorer")}
        </span>
        <button
          onClick={() => setIsAdding(true)}
          className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#e8e8e8]'}`}
          title={t("sidebar.addPackage")}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isAdding && (
          <div className={`px-3 py-2 border-b ${isDark ? 'border-[#2d2d2d] bg-[#1e1e1e]' : 'border-[#e0e0e0] bg-[#ffffff]'}`}>
            <div className="flex items-center gap-2">
              {addingParentId && (
                <span className={`text-xs ${isDark ? 'text-[#858585]' : 'text-[#9e9e9e]'}`}>
                  Subpaquete:
                </span>
              )}
              <input
                type="text"
                value={newPackageName}
                onChange={(e) => setNewPackageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddPackage();
                  if (e.key === "Escape") {
                    setIsAdding(false);
                    setAddingParentId(undefined);
                  }
                }}
                placeholder={t("sidebar.packageName")}
                className={`flex-1 px-2 py-1 text-sm rounded border focus:outline-none ${
                  isDark 
                    ? 'bg-[#3c3c3c] text-[#cccccc] border-[#454545] focus:border-blue-500' 
                    : 'bg-white text-[#383838] border-[#d0d0d0] focus:border-blue-600'
                }`}
                autoFocus
              />
              <button
                onClick={handleAddPackage}
                className={`p-1 rounded text-green-500 ${isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#e8e8e8]'}`}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setAddingParentId(undefined);
                }}
                className={`p-1 rounded text-red-500 ${isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#e8e8e8]'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {rootPackages.length === 0 && !isAdding && (
          <div className={`px-4 py-8 text-center text-sm ${isDark ? 'text-[#858585]' : 'text-[#9e9e9e]'}`}>
            {t("sidebar.noPackages")}
          </div>
        )}

        {rootPackages.map((pkg) => (
          <PackageItem
            key={pkg.id}
            pkg={pkg}
            nodes={nodes.filter((n) => n.data.package === pkg.name)}
            childPackages={getChildPackages(pkg.id)}
            allPackages={packages}
            allNodes={nodes}
            isEditing={editingId === pkg.id}
            editingName={editingName}
            onEditingNameChange={setEditingName}
            onStartEdit={handleStartEdit}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            onDelete={() => handleDeleteClick(pkg.id, pkg.name)}
            onAddSubPackage={handleStartAddSubPackage}
            onClassClick={handleClassClick}
            isDark={isDark}
            t={t}
            level={0}
          />
        ))}

        <UnassignedClasses 
          nodes={nodes.filter((n) => !n.data.package && n.type !== "umlNote")} 
          onClassClick={handleClassClick}
          isDark={isDark}
          t={t}
        />
      </div>

      {deleteConfirmation && (
        <DeletePackageModal
          isOpen={true}
          packageName={deleteConfirmation.name}
          hasClasses={deleteConfirmation.hasClasses}
          classCount={deleteConfirmation.classCount}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isDark={isDark}
          t={t}
        />
      )}
    </div>
  );
}
