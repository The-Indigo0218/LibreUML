import { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";
import { ClassItem } from "./ClassItem";
import { InlinePackageInput } from "./InlinePackageInput";
import type { PackageItemProps } from "./types";

export function PackageItem({
  node,
  level,
  expandedPaths,
  expandedClasses,
  renamingId,
  addingChildToPath,
  onToggle,
  onClassToggle,
  onClassClick,
  onEditClass,
  onPackageContextMenu,
  onClassContextMenu,
  onRenameClass,
  onCancelRename,
  onRenamePackage,
  onAddChildPackage,
  onCancelAddChild,
}: PackageItemProps) {
  // TODO: SSOT Migration - Package validation needs WorkspaceStore integration
  const packages: Array<{ id: string; name: string }> = [];
  
  const isExpanded = expandedPaths.has(node.fullPath);
  const hasChildren = node.children.size > 0;
  const hasClasses = node.classes.length > 0;
  const isEmpty = !hasChildren && !hasClasses;
  const isRenaming = renamingId === node.fullPath;
  const isAddingChild = addingChildToPath === node.fullPath;
  
  const [editValue, setEditValue] = useState(node.name);
  const [newChildName, setNewChildName] = useState("");
  const [hasError, setHasError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const validatePackageName = (newName: string): boolean => {
    const pathSegments = node.fullPath.split(".");
    pathSegments[pathSegments.length - 1] = newName;
    
    const parentPath = pathSegments.slice(0, -1).join(".");
    const siblings = packages.filter(pkg => {
      if (pkg.name === node.fullPath) return false;
      const pkgSegments = pkg.name.split(".");
      const pkgParent = pkgSegments.slice(0, -1).join(".");
      return pkgParent === parentPath && pkgSegments.length === pathSegments.length;
    });
    
    return siblings.some(pkg => {
      const pkgName = pkg.name.split(".").pop();
      return pkgName === newName;
    });
  };

  const handleCommit = () => {
    if (editValue.trim() && editValue !== node.name) {
      if (validatePackageName(editValue.trim())) {
        setHasError(true);
        setTimeout(() => {
          setEditValue(node.name);
          setHasError(false);
          onCancelRename();
        }, 2000);
      } else {
        onRenamePackage(node.fullPath, editValue.trim());
      }
    } else {
      onCancelRename();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditValue(node.name);
      onCancelRename();
    }
  };

  const handleAddChildCommit = () => {
    if (newChildName.trim()) {
      onAddChildPackage(node.fullPath, newChildName.trim());
      setNewChildName("");
    }
  };

  const handleAddChildCancel = () => {
    setNewChildName("");
    onCancelAddChild();
  };

  return (
    <div>
      {node.name !== "root" && (
        <>
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-surface-hover rounded cursor-pointer group transition-colors"
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={() => !isRenaming && onToggle(node.fullPath)}
            onContextMenu={(e) => onPackageContextMenu(e, node.fullPath, node.name)}
          >
            {hasChildren || hasClasses ? (
              <button className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-primary">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <div className="w-4" />
            )}

            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-yellow-500" />
            ) : (
              <Folder className="w-4 h-4 text-yellow-600" />
            )}

            {isRenaming ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleCommit}
                className={`flex-1 bg-surface-secondary text-sm outline-none px-1 py-0.5 rounded border transition-colors ${
                  hasError ? 'border-red-500 text-red-500' : 'border-uml-class-border text-text-primary'
                }`}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm text-text-secondary group-hover:text-text-primary flex-1 truncate">
                {node.name}
              </span>
            )}

            {!isRenaming && hasClasses && (
              <span className="text-[10px] text-text-muted bg-surface-secondary px-1.5 py-0.5 rounded">
                {node.classes.length}
              </span>
            )}

            {!isRenaming && isEmpty && (
              <span className="text-[10px] text-text-muted italic">empty</span>
            )}
          </div>
          {hasError && (
            <p className="text-xs text-red-500 mt-1 ml-2">Package name already exists at this level</p>
          )}
        </>
      )}

      {(isExpanded || node.name === "root") && (
        <>
          {isAddingChild && (
            <InlinePackageInput
              value={newChildName}
              onChange={setNewChildName}
              onCommit={handleAddChildCommit}
              onCancel={handleAddChildCancel}
              placeholder="subpackage"
              level={level + 1}
              parentPath={node.fullPath}
            />
          )}

          {node.classes.map((classNode) => (
            <ClassItem
              key={classNode.id}
              classNode={classNode}
              level={level + 1}
              isExpanded={expandedClasses.has(classNode.id)}
              isRenaming={renamingId === classNode.id}
              onToggle={onClassToggle}
              onClassClick={onClassClick}
              onEditClass={onEditClass}
              onContextMenu={onClassContextMenu}
              onRename={onRenameClass}
              onCancelRename={onCancelRename}
            />
          ))}

          {Array.from(node.children.values())
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((childNode) => (
              <PackageItem
                key={childNode.fullPath}
                node={childNode}
                level={level + 1}
                expandedPaths={expandedPaths}
                expandedClasses={expandedClasses}
                renamingId={renamingId}
                addingChildToPath={addingChildToPath}
                onToggle={onToggle}
                onClassToggle={onClassToggle}
                onClassClick={onClassClick}
                onEditClass={onEditClass}
                onPackageContextMenu={onPackageContextMenu}
                onClassContextMenu={onClassContextMenu}
                onRenameClass={onRenameClass}
                onCancelRename={onCancelRename}
                onRenamePackage={onRenamePackage}
                onAddChildPackage={onAddChildPackage}
                onCancelAddChild={onCancelAddChild}
              />
            ))}
        </>
      )}
    </div>
  );
}
