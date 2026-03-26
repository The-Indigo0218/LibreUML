import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Package, FolderPlus } from "lucide-react";
import { useSettingsStore } from "../../../../store/settingsStore";
import { useUiStore } from "../../../../store/uiStore";
import { useModelStore } from "../../../../store/model.store";
import { useToastStore } from "../../../../store/toast.store";
import { buildPackageTree } from "./packageExplorer/buildPackageTree";
import { PackageItem } from "./packageExplorer/PackageItem";
import { ClassItem } from "./packageExplorer/ClassItem";
import { InlinePackageInput } from "./packageExplorer/InlinePackageInput";
import { DeletePackageModal } from "./packageExplorer/DeletePackageModal";
import type { UmlClassNode, UmlAttribute, UmlMethod, visibility as UmlVisibility } from "../../types/diagram.types";
import type { DeletePackageState, TreeNode } from "./packageExplorer/types";
import type { SemanticModel } from "../../../../core/domain/vfs/vfs.types";

// ── IR → UmlClassNode adapter ─────────────────────────────────────────────

function irVisToSymbol(v: string | undefined): UmlVisibility {
  if (v === "private") return "-";
  if (v === "protected") return "#";
  if (v === "package") return "~";
  return "+";
}

function irToUmlNodes(model: SemanticModel): UmlClassNode[] {
  const nodes: UmlClassNode[] = [];

  for (const cls of Object.values(model.classes)) {
    if (cls.isExternal) continue;
    const attributes: UmlAttribute[] = cls.attributeIds.flatMap((id) => {
      const a = model.attributes[id];
      if (!a) return [];
      return [{
        id: a.id,
        name: a.name,
        type: a.type,
        visibility: irVisToSymbol(a.visibility),
        isArray: a.multiplicity === "*" || a.multiplicity === "0..*",
      }];
    });
    const methods: UmlMethod[] = cls.operationIds.flatMap((id) => {
      const o = model.operations[id];
      if (!o) return [];
      return [{
        id: o.id,
        name: o.name,
        returnType: o.returnType ?? "void",
        visibility: irVisToSymbol(o.visibility),
        parameters: o.parameters.map((p) => ({ name: p.name, type: p.type })),
      }];
    });
    nodes.push({
      id: cls.id,
      type: "umlClass",
      position: { x: 0, y: 0 },
      data: {
        label: cls.name,
        stereotype: cls.isAbstract ? "abstract" : "class",
        package: cls.packageName ?? "",
        attributes,
        methods,
      },
    });
  }

  for (const iface of Object.values(model.interfaces)) {
    if (iface.isExternal) continue;
    const methods: UmlMethod[] = iface.operationIds.flatMap((id) => {
      const o = model.operations[id];
      if (!o) return [];
      return [{
        id: o.id,
        name: o.name,
        returnType: o.returnType ?? "void",
        visibility: irVisToSymbol(o.visibility),
        parameters: o.parameters.map((p) => ({ name: p.name, type: p.type })),
      }];
    });
    nodes.push({
      id: iface.id,
      type: "umlClass",
      position: { x: 0, y: 0 },
      data: {
        label: iface.name,
        stereotype: "interface",
        package: iface.packageName ?? "",
        attributes: [],
        methods,
      },
    });
  }

  for (const enm of Object.values(model.enums)) {
    if (enm.isExternal) continue;
    nodes.push({
      id: enm.id,
      type: "umlClass",
      position: { x: 0, y: 0 },
      data: {
        label: enm.name,
        stereotype: "enum",
        package: enm.packageName ?? "",
        attributes: [],
        methods: [],
      },
    });
  }

  return nodes;
}

// ── Local context menu type ───────────────────────────────────────────────

interface LocalContextMenu {
  x: number;
  y: number;
  type: "package" | "class";
  id: string;
  name: string;
  packagePath?: string;
}

interface PkgPickerState {
  elementId: string;
  x: number;
  y: number;
}

export default function PackageExplorer() {
  const model = useModelStore((s) => s.model);
  const addPackageName = useModelStore((s) => s.addPackageName);
  const removePackageName = useModelStore((s) => s.removePackageName);
  const setElementPackage = useModelStore((s) => s.setElementPackage);
  const updateClass = useModelStore((s) => s.updateClass);
  const updateInterface = useModelStore((s) => s.updateInterface);
  const updateEnum = useModelStore((s) => s.updateEnum);
  const deleteClass = useModelStore((s) => s.deleteClass);
  const deleteInterface = useModelStore((s) => s.deleteInterface);
  const deleteEnum = useModelStore((s) => s.deleteEnum);

  const { openSSoTClassEditor, openSingleGenerator } = useUiStore();
  const showToast = useToastStore((s) => s.show);
  const theme = useSettingsStore((s) => s.theme);
  const { t } = useTranslation();

  // ── Derived data ───────────────────────────────────────────────────────

  const transformedNodes: UmlClassNode[] = useMemo(() => {
    if (!model) return [];
    return irToUmlNodes(model);
  }, [model]);

  const allPackages: Array<{ id: string; name: string }> = useMemo(() => {
    if (!model) return [];
    const pkgSet = new Map<string, { id: string; name: string }>();

    // Explicit packages from model
    (model.packageNames ?? []).forEach((name) => {
      pkgSet.set(name, { id: `pkg-${name}`, name });
    });

    // Auto-discover implicit packages from element packageName fields
    transformedNodes.forEach((node) => {
      const pkgName = node.data.package;
      if (!pkgName || pkgName.trim() === "") return;
      const segments = pkgName.split(".").filter((s) => s.trim() !== "");
      let currentPath = "";
      segments.forEach((segment) => {
        currentPath = currentPath ? `${currentPath}.${segment}` : segment;
        if (!pkgSet.has(currentPath)) {
          pkgSet.set(currentPath, { id: `implicit-${currentPath}`, name: currentPath });
        }
      });
    });

    return Array.from(pkgSet.values());
  }, [model, transformedNodes]);

  const packageTree = useMemo(() => buildPackageTree(allPackages, transformedNodes), [allPackages, transformedNodes]);

  // Strip root-level classes from the tree passed to PackageItem — they are
  // already rendered in the explicit (default) folder above, so passing them
  // to PackageItem would cause every unassigned element to appear twice.
  const packageTreeForItem = useMemo(() => ({ ...packageTree, classes: [] }), [packageTree]);

  const totalElements = transformedNodes.length;
  const unassignedCount = packageTree.classes.length;
  const displayedPackageCount = allPackages.length + (unassignedCount > 0 ? 1 : 0);

  // ── UI state ───────────────────────────────────────────────────────────

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [isAddingGlobal, setIsAddingGlobal] = useState(false);
  const [newPackageName, setNewPackageName] = useState("");
  const [contextMenu, setContextMenu] = useState<LocalContextMenu | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [addingChildToPath, setAddingChildToPath] = useState<string | null>(null);
  const [deletePackageState, setDeletePackageState] = useState<DeletePackageState | null>(null);
  const [pkgPicker, setPkgPicker] = useState<PkgPickerState | null>(null);

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
      setPkgPicker(null);
    };
    if (contextMenu || pkgPicker) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu, pkgPicker]);

  // ── Package mutations ──────────────────────────────────────────────────

  const addPackage = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if ((model?.packageNames ?? []).includes(trimmed)) {
      showToast(`Package "${trimmed}" already exists.`);
      return;
    }
    addPackageName(trimmed);
    showToast(`Package "${trimmed}" created.`);
  }, [model, addPackageName, showToast]);

  const updatePackageName = useCallback((packagePath: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === packagePath) return;

    const pathSegments = packagePath.split(".");
    pathSegments[pathSegments.length - 1] = trimmed;
    const newFullPath = pathSegments.join(".");

    removePackageName(packagePath);
    addPackageName(newFullPath);

    // Rename on all affected elements
    if (!model) return;
    [...Object.values(model.classes), ...Object.values(model.interfaces), ...Object.values(model.enums)].forEach((el) => {
      if (el.packageName === packagePath) {
        setElementPackage(el.id, newFullPath);
      }
    });
    showToast(`Package renamed to "${newFullPath}".`);
  }, [model, removePackageName, addPackageName, setElementPackage, showToast]);

  const deletePackage = useCallback((pkgPath: string, deleteClasses: boolean) => {
    if (!model) return;

    const allEls = [
      ...Object.values(model.classes),
      ...Object.values(model.interfaces),
      ...Object.values(model.enums),
    ];
    const affected = allEls.filter((el) => el.packageName === pkgPath);

    if (deleteClasses) {
      affected.forEach((el) => {
        if (model.classes[el.id]) deleteClass(el.id);
        else if (model.interfaces[el.id]) deleteInterface(el.id);
        else deleteEnum(el.id);
      });
    } else {
      affected.forEach((el) => setElementPackage(el.id, undefined));
    }

    removePackageName(pkgPath);
    showToast(`Package "${pkgPath}" deleted.`);
  }, [model, deleteClass, deleteInterface, deleteEnum, setElementPackage, removePackageName, showToast]);

  const deleteElement = useCallback((elementId: string) => {
    if (!model) return;
    if (model.classes[elementId]) { deleteClass(elementId); return; }
    if (model.interfaces[elementId]) { deleteInterface(elementId); return; }
    if (model.enums[elementId]) { deleteEnum(elementId); return; }
  }, [model, deleteClass, deleteInterface, deleteEnum]);

  const renameElement = useCallback((elementId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || !model) return;
    if (model.classes[elementId]) updateClass(elementId, { name: trimmed });
    else if (model.interfaces[elementId]) updateInterface(elementId, { name: trimmed });
    else if (model.enums[elementId]) updateEnum(elementId, { name: trimmed });
    showToast(`Renamed to "${trimmed}".`);
  }, [model, updateClass, updateInterface, updateEnum, showToast]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleToggle = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleClassToggle = (classId: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const handleClassClick = (nodeId: string) => {
    openSSoTClassEditor(nodeId);
  };

  const handleEditClass = (nodeId: string) => {
    openSSoTClassEditor(nodeId);
  };

  const handleAddPackageClick = () => {
    setIsAddingGlobal(true);
    setNewPackageName("");
  };

  const handleCommitGlobalPackage = () => {
    if (newPackageName.trim()) {
      addPackage(newPackageName.trim());
      setIsAddingGlobal(false);
      setNewPackageName("");
    }
  };

  const handleCancelGlobalPackage = () => {
    setIsAddingGlobal(false);
    setNewPackageName("");
  };

  const handleAddChildPackage = (parentPath: string, childName: string) => {
    const fullPath = `${parentPath}.${childName}`;
    addPackage(fullPath);
    setAddingChildToPath(null);
    setExpandedPaths((prev) => new Set(prev).add(parentPath));
  };

  const handleCancelAddChild = () => setAddingChildToPath(null);

  const handlePackageContextMenu = (e: React.MouseEvent, packagePath: string, packageName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: "package", id: packagePath, name: packageName, packagePath });
  };

  const handleClassContextMenu = (e: React.MouseEvent, classId: string, className: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: "class", id: classId, name: className });
  };

  const handleRenameClick = () => {
    if (!contextMenu) return;
    setRenamingId(contextMenu.type === "package" ? contextMenu.packagePath! : contextMenu.id);
    setContextMenu(null);
  };

  const handleAddChildClick = () => {
    if (!contextMenu || contextMenu.type !== "package") return;
    setAddingChildToPath(contextMenu.packagePath!);
    setExpandedPaths((prev) => new Set(prev).add(contextMenu.packagePath!));
    setContextMenu(null);
  };

  const handleDeleteClick = () => {
    if (!contextMenu) return;
    if (contextMenu.type === "package") {
      const classesInPackage = transformedNodes.filter((n) => n.data.package === contextMenu.packagePath);
      setDeletePackageState({
        id: contextMenu.packagePath!,
        name: contextMenu.name,
        packagePath: contextMenu.packagePath!,
        hasClasses: classesInPackage.length > 0,
        classCount: classesInPackage.length,
      });
    } else {
      deleteElement(contextMenu.id);
    }
    setContextMenu(null);
  };

  const handleConfirmDeletePackage = (deleteClasses: boolean) => {
    if (!deletePackageState) return;
    deletePackage(deletePackageState.packagePath, deleteClasses);
    setDeletePackageState(null);
  };

  const handleCancelDeletePackage = () => setDeletePackageState(null);

  const handleRenamePackage = (packagePath: string, newName: string) => {
    updatePackageName(packagePath, newName);
    setRenamingId(null);
  };

  const handleRenameClass = (classId: string, newName: string) => {
    renameElement(classId, newName);
    setRenamingId(null);
  };

  const handleCancelRename = () => setRenamingId(null);

  const handleMoveToPackage = (elementId: string, targetPkg: string | undefined) => {
    setElementPackage(elementId, targetPkg);
    showToast(targetPkg ? `Moved to "${targetPkg}".` : "Removed from package.");
    setPkgPicker(null);
  };

  return (
    <div className="flex flex-col h-full bg-surface-primary border-r border-surface-border">
      <div className="px-4 py-3 border-b border-surface-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-uml-class-border" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
              Packages
            </h3>
          </div>
          <button
            onClick={handleAddPackageClick}
            className="p-1.5 hover:bg-surface-hover rounded transition-colors text-text-secondary hover:text-uml-class-border"
            title="New Package"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>{displayedPackageCount} package{displayedPackageCount !== 1 ? "s" : ""}</span>
          <span>•</span>
          <span>{totalElements} element{totalElements !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {isAddingGlobal && (
          <InlinePackageInput
            value={newPackageName}
            onChange={setNewPackageName}
            onCommit={handleCommitGlobalPackage}
            onCancel={handleCancelGlobalPackage}
            placeholder="com.example.models"
            level={0}
          />
        )}

        {!model || (totalElements === 0 && !isAddingGlobal) ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Package className="w-12 h-12 text-text-muted/30 mb-3" />
            <p className="text-sm text-text-muted">{t('packageExplorer.noPackages')}</p>
            <p className="text-xs text-text-muted/70 mt-1">
              {t('packageExplorer.addClasses')}
            </p>
          </div>
        ) : (
          <>
            {unassignedCount > 0 && (
              <div className="mb-4">
                <div
                  className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-surface-hover rounded cursor-pointer group transition-colors"
                  onClick={() => handleToggle("__unassigned__")}
                >
                  <button className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-primary">
                    {expandedPaths.has("__unassigned__") ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {expandedPaths.has("__unassigned__") ? (
                    <FolderOpen className="w-4 h-4 text-gray-500" />
                  ) : (
                    <Folder className="w-4 h-4 text-gray-600" />
                  )}
                  <span className="text-sm text-text-secondary group-hover:text-text-primary flex-1">
                    (default)
                  </span>
                  <span className="text-[10px] text-text-muted bg-surface-secondary px-1.5 py-0.5 rounded">
                    {unassignedCount}
                  </span>
                </div>

                {expandedPaths.has("__unassigned__") &&
                  packageTree.classes.map((classNode) => (
                    <ClassItem
                      key={classNode.id}
                      classNode={classNode}
                      level={1}
                      isExpanded={expandedClasses.has(classNode.id)}
                      isRenaming={renamingId === classNode.id}
                      onToggle={handleClassToggle}
                      onClassClick={handleClassClick}
                      onEditClass={handleEditClass}
                      onContextMenu={handleClassContextMenu}
                      onRename={handleRenameClass}
                      onCancelRename={handleCancelRename}
                    />
                  ))}
              </div>
            )}

            <PackageItem
              node={packageTreeForItem}
              level={0}
              expandedPaths={expandedPaths}
              expandedClasses={expandedClasses}
              renamingId={renamingId}
              addingChildToPath={addingChildToPath}
              onToggle={handleToggle}
              onClassToggle={handleClassToggle}
              onClassClick={handleClassClick}
              onEditClass={handleEditClass}
              onPackageContextMenu={handlePackageContextMenu}
              onClassContextMenu={handleClassContextMenu}
              onRenameClass={handleRenameClass}
              onCancelRename={handleCancelRename}
              onRenamePackage={handleRenamePackage}
              onAddChildPackage={handleAddChildPackage}
              onCancelAddChild={handleCancelAddChild}
            />
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-surface-border">
        <button
          className="w-full text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover py-2 rounded transition-colors"
          onClick={() => {
            const allPaths = new Set<string>();
            const collectPaths = (node: TreeNode) => {
              if (node.fullPath) allPaths.add(node.fullPath);
              node.children.forEach((child) => collectPaths(child));
            };
            collectPaths(packageTree);
            allPaths.add("__unassigned__");
            setExpandedPaths(allPaths);
          }}
        >
          Expand All
        </button>
        <button
          className="w-full text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover py-2 rounded transition-colors"
          onClick={() => setExpandedPaths(new Set())}
        >
          Collapse All
        </button>
      </div>

      {/* ── Custom context menu ──────────────────────────────────────────── */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-surface-primary border border-surface-border rounded shadow-lg py-1 min-w-[160px]"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 180) }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "package" ? (
            <>
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-surface-hover"
                onClick={handleAddChildClick}
              >
                New Sub-Package
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-surface-hover"
                onClick={handleRenameClick}
              >
                Rename
              </button>
              <hr className="border-surface-border my-1" />
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-surface-hover"
                onClick={handleDeleteClick}
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-surface-hover"
                onClick={() => { openSSoTClassEditor(contextMenu.id); setContextMenu(null); }}
              >
                Edit...
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-surface-hover"
                onClick={() => { openSingleGenerator(contextMenu.id); setContextMenu(null); }}
              >
                Generate Code...
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-surface-hover"
                onClick={() => {
                  setPkgPicker({ elementId: contextMenu.id, x: contextMenu.x, y: contextMenu.y });
                  setContextMenu(null);
                }}
              >
                Move to Package...
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-surface-hover"
                onClick={handleRenameClick}
              >
                Rename
              </button>
              <hr className="border-surface-border my-1" />
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-surface-hover"
                onClick={handleDeleteClick}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Package picker popup ─────────────────────────────────────────── */}
      {pkgPicker && (
        <div
          className="fixed z-50 bg-surface-primary border border-surface-border rounded shadow-lg py-1 min-w-[180px]"
          style={{ top: Math.min(pkgPicker.y, window.innerHeight - 220), left: Math.min(pkgPicker.x, window.innerWidth - 200) }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1 text-xs text-text-muted font-semibold uppercase tracking-wide border-b border-surface-border mb-1">
            Move to Package
          </p>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover italic"
            onClick={() => handleMoveToPackage(pkgPicker.elementId, undefined)}
          >
            (default)
          </button>
          {(model?.packageNames ?? []).map((pkgName) => (
            <button
              key={pkgName}
              className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-surface-hover"
              onClick={() => handleMoveToPackage(pkgPicker.elementId, pkgName)}
            >
              {pkgName}
            </button>
          ))}
        </div>
      )}

      <DeletePackageModal
        isOpen={deletePackageState !== null}
        packageName={deletePackageState?.name || ""}
        hasClasses={deletePackageState?.hasClasses || false}
        classCount={deletePackageState?.classCount || 0}
        onConfirm={handleConfirmDeletePackage}
        onCancel={handleCancelDeletePackage}
        isDark={theme === "dark"}
        t={t}
      />
    </div>
  );
}
