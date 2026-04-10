import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Package, FolderPlus } from "lucide-react";
import { useSettingsStore } from "../../../../store/settingsStore";
import { useUiStore } from "../../../../store/uiStore";
import { useModelStore } from "../../../../store/model.store";
import { useToastStore } from "../../../../store/toast.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { standaloneModelOps } from "../../../../store/standaloneModelOps";
import { buildPackageTree } from "./packageExplorer/buildPackageTree";
import { PackageItem } from "./packageExplorer/PackageItem";
import { ClassItem } from "./packageExplorer/ClassItem";
import { InlinePackageInput } from "./packageExplorer/InlinePackageInput";
import { DeletePackageModal } from "./packageExplorer/DeletePackageModal";
import { isDiagramView } from "../../hooks/useVFSCanvasController";
import { undoTransaction } from "../../../../core/undo/undoBridge";
import type { UmlClassNode, UmlAttribute, UmlMethod, visibility as UmlVisibility } from "../../types/diagram.types";
import type { DeletePackageState, TreeNode } from "./packageExplorer/types";
import type { SemanticModel, VFSFile, ViewNode } from "../../../../core/domain/vfs/vfs.types";

const SIDEBAR_DND_TYPE = 'application/libreuml-sidebar-class';


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

  // ── Standalone context ─────────────────────────────────────────────────

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const isStandalone = useVFSStore((s): boolean => {
    if (!activeTabId || !s.project) return false;
    const node = s.project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return false;
    return (node as VFSFile).standalone === true;
  });
  const localModel = useVFSStore((s): SemanticModel | null => {
    if (!activeTabId || !s.project) return null;
    const node = s.project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return null;
    return (node as VFSFile).localModel ?? null;
  });

  const activeModel = isStandalone ? localModel : model;

  const viewNodes = useVFSStore((s): ViewNode[] => {
    if (!activeTabId || !s.project) return [];
    const node = s.project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return [];
    const content = (node as VFSFile).content;
    if (!isDiagramView(content)) return [];
    return content.nodes;
  });

  // ── Derived data ───────────────────────────────────────────────────────

  const transformedNodes: UmlClassNode[] = useMemo(() => {
    if (!activeModel) return [];
    return irToUmlNodes(activeModel);
  }, [activeModel]);

  const elementViewNodeMap = useMemo(() => {
    const map = new Map<string, ViewNode>();
    for (const vn of viewNodes) map.set(vn.elementId, vn);
    return map;
  }, [viewNodes]);

  // Resolve effective visual tree paths for packages based on canvas parentPackageId nesting.
  // E.g. if package "ServiceLayer" is dragged inside "Infrastructure" on canvas,
  // its effective path becomes "Infrastructure.ServiceLayer" so the sidebar tree mirrors the canvas.
  const pkgEffectivePaths = useMemo((): Map<string, string> => {
    const result = new Map<string, string>();
    if (!activeModel?.packages || !viewNodes.length) return result;

    const vnToPkgId = new Map<string, string>();
    const pkgIdToVN = new Map<string, ViewNode>();
    for (const vn of viewNodes) {
      if (activeModel.packages[vn.elementId]) {
        vnToPkgId.set(vn.id, vn.elementId);
        pkgIdToVN.set(vn.elementId, vn);
      }
    }

    const resolve = (pkgId: string, visiting: Set<string>): string => {
      if (result.has(pkgId)) return result.get(pkgId)!;
      if (visiting.has(pkgId)) return activeModel.packages![pkgId]?.name ?? pkgId;

      const pkg = activeModel.packages![pkgId];
      if (!pkg) return pkgId;

      const vn = pkgIdToVN.get(pkgId);
      if (!vn?.parentPackageId) {
        result.set(pkgId, pkg.name);
        return pkg.name;
      }

      const parentPkgId = vnToPkgId.get(vn.parentPackageId);
      if (!parentPkgId) {
        result.set(pkgId, pkg.name);
        return pkg.name;
      }

      const path = `${resolve(parentPkgId, new Set([...visiting, pkgId]))}.${pkg.name}`;
      result.set(pkgId, path);
      return path;
    };

    for (const pkgId of Object.keys(activeModel.packages)) {
      resolve(pkgId, new Set());
    }
    return result;
  }, [activeModel, viewNodes]);

  const allPackages: Array<{ id: string; name: string }> = useMemo(() => {
    if (!activeModel) return [];
    const pkgSet = new Map<string, { id: string; name: string }>();

    // Visual packages from IR model (canvas packages — real IRPackage entries).
    // Use effective paths so visually nested packages appear in the right tree position.
    Object.values(activeModel.packages ?? {}).forEach((pkg) => {
      if (pkg.name && pkg.name.trim() !== "") {
        const effectiveName = pkgEffectivePaths.get(pkg.id) ?? pkg.name;
        pkgSet.set(effectiveName, { id: pkg.id, name: effectiveName });
      }
    });

    // Explicit semantic packages from model
    (activeModel.packageNames ?? []).forEach((name) => {
      if (!pkgSet.has(name)) pkgSet.set(name, { id: `pkg-${name}`, name });
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
  }, [activeModel, transformedNodes, pkgEffectivePaths]);

  // Resolve visual containment: if a node's ViewNode has parentPackageId,
  // override its package field with the effective path of the parent package
  // (accounting for multi-level canvas nesting).
  const resolvedNodes = useMemo(() => {
    if (!viewNodes.length || !activeModel?.packages) return transformedNodes;

    const pkgViewNodeToEffectivePath = new Map<string, string>();
    for (const vn of viewNodes) {
      const pkg = activeModel.packages[vn.elementId];
      if (pkg) {
        pkgViewNodeToEffectivePath.set(vn.id, pkgEffectivePaths.get(pkg.id) ?? pkg.name);
      }
    }

    return transformedNodes.map((node) => {
      const vn = elementViewNodeMap.get(node.id);
      if (!vn?.parentPackageId) return node;
      const parentPath = pkgViewNodeToEffectivePath.get(vn.parentPackageId);
      if (!parentPath) return node;
      return { ...node, data: { ...node.data, package: parentPath } };
    });
  }, [transformedNodes, viewNodes, elementViewNodeMap, activeModel, pkgEffectivePaths]);

  const packageTree = useMemo(() => buildPackageTree(allPackages, resolvedNodes), [allPackages, resolvedNodes]);
  const packageTreeForItem = useMemo(() => ({ ...packageTree, classes: [] }), [packageTree]);

  const totalElements = resolvedNodes.length;
  const unassignedCount = packageTree.classes.length;
  const displayedPackageCount = allPackages.length + (unassignedCount > 0 ? 1 : 0);
  const hasPackages = allPackages.length > 0;

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

  const addPackage = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if ((activeModel?.packageNames ?? []).includes(trimmed)) {
      showToast(`Package "${trimmed}" already exists.`);
      return;
    }
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).addPackageName(trimmed);
    } else {
      addPackageName(trimmed);
    }
    showToast(`Package "${trimmed}" created.`);
  }, [activeModel, isStandalone, activeTabId, addPackageName, showToast]);

  const updatePackageName = useCallback((packagePath: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === packagePath) return;

    const pathSegments = packagePath.split(".");
    pathSegments[pathSegments.length - 1] = trimmed;
    const newFullPath = pathSegments.join(".");

    if (isStandalone && activeTabId) {
      const ops = standaloneModelOps(activeTabId);
      ops.removePackageName(packagePath);
      ops.addPackageName(newFullPath);
      if (!activeModel) return;
      [...Object.values(activeModel.classes), ...Object.values(activeModel.interfaces), ...Object.values(activeModel.enums)].forEach((el) => {
        if (el.packageName === packagePath) ops.setElementPackage(el.id, newFullPath);
      });
    } else {
      removePackageName(packagePath);
      addPackageName(newFullPath);
      if (!activeModel) return;
      [...Object.values(activeModel.classes), ...Object.values(activeModel.interfaces), ...Object.values(activeModel.enums)].forEach((el) => {
        if (el.packageName === packagePath) setElementPackage(el.id, newFullPath);
      });
    }
    showToast(`Package renamed to "${newFullPath}".`);
  }, [activeModel, isStandalone, activeTabId, removePackageName, addPackageName, setElementPackage, showToast]);

  const deletePackage = useCallback((pkgPath: string, deleteClasses: boolean) => {
    if (!activeModel) return;

    // Resolve the IRPackage entry for this path (if it's a visual canvas package).
    const irPkg = Object.values(activeModel.packages ?? {}).find(
      (pkg) => (pkgEffectivePaths.get(pkg.id) ?? pkg.name) === pkgPath
    );

    const allEls = [
      ...Object.values(activeModel.classes),
      ...Object.values(activeModel.interfaces),
      ...Object.values(activeModel.enums),
    ];
    const affected = allEls.filter(
      (el) => el.packageName === pkgPath || el.packageName?.startsWith(`${pkgPath}.`)
    );

    // Collect affected relation IDs (for edge removal) before mutating.
    const deletedRelationIds = new Set<string>();
    if (deleteClasses && activeModel.relations) {
      const affectedIds = new Set(affected.map((el) => el.id));
      for (const [rid, rel] of Object.entries(activeModel.relations)) {
        if (affectedIds.has(rel.sourceId) || affectedIds.has(rel.targetId)) {
          deletedRelationIds.add(rid);
        }
      }
    }

    if (isStandalone && activeTabId) {
      undoTransaction({
        label: `Delete Package: ${pkgPath}`,
        scope: activeTabId,
        mutations: [{
          store: 'vfs',
          mutate: (draft: any) => {
            const file = draft.project?.nodes[activeTabId];
            if (!file || file.type !== 'FILE') return;

            // 1. Mutate localModel
            if (file.localModel) {
              if (irPkg) delete file.localModel.packages[irPkg.id];
              if (file.localModel.packageNames) {
                file.localModel.packageNames = file.localModel.packageNames.filter(
                  (n: string) => n !== pkgPath && !n.startsWith(`${pkgPath}.`)
                );
              }
              if (deleteClasses) {
                affected.forEach((el) => {
                  delete file.localModel.classes?.[el.id];
                  delete file.localModel.interfaces?.[el.id];
                  delete file.localModel.enums?.[el.id];
                });
                for (const rid of deletedRelationIds) {
                  if (file.localModel.relations) delete file.localModel.relations[rid];
                }
              } else {
                affected.forEach((el) => {
                  const rec = file.localModel.classes?.[el.id]
                    ?? file.localModel.interfaces?.[el.id]
                    ?? file.localModel.enums?.[el.id];
                  if (rec) rec.packageName = undefined;
                });
              }
              file.localModel.updatedAt = Date.now();
            }

            // 2. Cascade ViewNode removal and un-nest children
            if (isDiagramView(file.content)) {
              if (irPkg) {
                const pkgVN = file.content.nodes.find((vn: ViewNode) => vn.elementId === irPkg.id);
                if (pkgVN) {
                  file.content.nodes = file.content.nodes
                    .map((vn: ViewNode) =>
                      vn.parentPackageId === pkgVN.id ? { ...vn, parentPackageId: null } : vn
                    )
                    .filter((vn: ViewNode) => vn.elementId !== irPkg.id);
                }
              }
              if (deleteClasses) {
                const deletedIds = new Set(affected.map((el) => el.id));
                file.content.nodes = file.content.nodes.filter((vn: ViewNode) => !deletedIds.has(vn.elementId));
                file.content.edges = file.content.edges.filter((ve: any) => !deletedRelationIds.has(ve.relationId));
              }
            }
          },
        }],
      });
    } else {
      undoTransaction({
        label: `Delete Package: ${pkgPath}`,
        scope: 'global',
        mutations: [
          {
            store: 'model',
            mutate: (draft: any) => {
              if (!draft.model) return;
              if (irPkg) delete draft.model.packages[irPkg.id];
              if (draft.model.packageNames) {
                draft.model.packageNames = draft.model.packageNames.filter(
                  (n: string) => n !== pkgPath && !n.startsWith(`${pkgPath}.`)
                );
              }
              if (deleteClasses) {
                affected.forEach((el) => {
                  delete draft.model.classes[el.id];
                  delete draft.model.interfaces[el.id];
                  delete draft.model.enums[el.id];
                });
                for (const rid of deletedRelationIds) {
                  delete draft.model.relations[rid];
                }
              } else {
                affected.forEach((el) => {
                  const rec = draft.model.classes[el.id]
                    ?? draft.model.interfaces[el.id]
                    ?? draft.model.enums[el.id];
                  if (rec) rec.packageName = undefined;
                });
              }
              draft.model.updatedAt = Date.now();
            },
          },
          {
            store: 'vfs',
            mutate: (draft: any) => {
              if (!draft.project) return;
              const deletedElementIds = new Set(deleteClasses ? affected.map((el) => el.id) : []);
              for (const fileNode of Object.values(draft.project.nodes as Record<string, any>)) {
                if (fileNode.type !== 'FILE' || !isDiagramView(fileNode.content)) continue;
                if (irPkg) {
                  const pkgVN = fileNode.content.nodes.find((vn: ViewNode) => vn.elementId === irPkg.id);
                  if (pkgVN) {
                    fileNode.content.nodes = fileNode.content.nodes
                      .map((vn: ViewNode) =>
                        vn.parentPackageId === pkgVN.id ? { ...vn, parentPackageId: null } : vn
                      )
                      .filter((vn: ViewNode) => vn.elementId !== irPkg.id);
                  }
                }
                if (deleteClasses && deletedElementIds.size > 0) {
                  fileNode.content.nodes = fileNode.content.nodes.filter(
                    (vn: ViewNode) => !deletedElementIds.has(vn.elementId)
                  );
                  fileNode.content.edges = fileNode.content.edges.filter(
                    (ve: any) => !deletedRelationIds.has(ve.relationId)
                  );
                }
              }
            },
          },
        ],
      });
    }
    showToast(`Package "${pkgPath}" deleted.`);
  }, [activeModel, isStandalone, activeTabId, pkgEffectivePaths, showToast]);

  const deleteElement = useCallback((elementId: string) => {
    if (!activeModel) return;
    if (isStandalone && activeTabId) {
      const ops = standaloneModelOps(activeTabId);
      if (activeModel.classes[elementId]) ops.deleteClass(elementId);
      else if (activeModel.interfaces[elementId]) ops.deleteInterface(elementId);
      else if (activeModel.enums[elementId]) ops.deleteEnum(elementId);
    } else {
      if (activeModel.classes[elementId]) { deleteClass(elementId); return; }
      if (activeModel.interfaces[elementId]) { deleteInterface(elementId); return; }
      if (activeModel.enums[elementId]) { deleteEnum(elementId); return; }
    }
  }, [activeModel, isStandalone, activeTabId, deleteClass, deleteInterface, deleteEnum]);

  const renameElement = useCallback((elementId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || !activeModel) return;
    if (isStandalone && activeTabId) {
      const ops = standaloneModelOps(activeTabId);
      if (activeModel.classes[elementId]) ops.updateClass(elementId, { name: trimmed });
      else if (activeModel.interfaces[elementId]) ops.updateInterface(elementId, { name: trimmed });
      else if (activeModel.enums[elementId]) ops.updateEnum(elementId, { name: trimmed });
    } else {
      if (activeModel.classes[elementId]) updateClass(elementId, { name: trimmed });
      else if (activeModel.interfaces[elementId]) updateInterface(elementId, { name: trimmed });
      else if (activeModel.enums[elementId]) updateEnum(elementId, { name: trimmed });
    }
    showToast(`Renamed to "${trimmed}".`);
  }, [activeModel, isStandalone, activeTabId, updateClass, updateInterface, updateEnum, showToast]);

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
      const classesInPackage = resolvedNodes.filter((n) => n.data.package === contextMenu.packagePath);
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

  const handleMoveToPackage = useCallback((elementId: string, targetPkg: string | undefined) => {
    if (isStandalone && activeTabId) {
      standaloneModelOps(activeTabId).setElementPackage(elementId, targetPkg);
    } else {
      setElementPackage(elementId, targetPkg);
    }
    showToast(targetPkg ? `Moved to "${targetPkg}".` : "Removed from package.");
    setPkgPicker(null);
  }, [isStandalone, activeTabId, setElementPackage, showToast]);

  const getViewNodeId = useCallback((elementId: string): string | undefined => {
    return elementViewNodeMap.get(elementId)?.id;
  }, [elementViewNodeMap]);

  const handleClassDragStart = useCallback((e: React.DragEvent, elementId: string, viewNodeId: string | undefined) => {
    e.dataTransfer.setData(SIDEBAR_DND_TYPE, JSON.stringify({ elementId, viewNodeId }));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDropOnPackage = useCallback((e: React.DragEvent, targetPkgPath: string) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(SIDEBAR_DND_TYPE);
    if (!raw) return;

    let payload: { elementId: string; viewNodeId?: string };
    try { payload = JSON.parse(raw); } catch { return; }
    const { elementId, viewNodeId } = payload;

    if (viewNodeId && activeTabId && activeModel?.packages) {
      const targetPkg = Object.values(activeModel.packages).find(
        (p) => (pkgEffectivePaths.get(p.id) ?? p.name) === targetPkgPath
      );
      if (targetPkg) {
        const targetViewNode = viewNodes.find((vn) => vn.elementId === targetPkg.id);
        if (targetViewNode) {
          undoTransaction({
            label: `Move to package: ${targetPkgPath}`,
            scope: isStandalone ? activeTabId : 'global',
            mutations: [
              {
                store: 'vfs',
                mutate: (draft: any) => {
                  const file = draft.project?.nodes[activeTabId];
                  if (!file || file.type !== 'FILE' || !isDiagramView(file.content)) return;
                  const vn = file.content.nodes.find((n: ViewNode) => n.id === viewNodeId);
                  if (vn) vn.parentPackageId = targetViewNode.id;
                  // For standalone: also update packageName in localModel
                  if (isStandalone && file.localModel) {
                    const el = file.localModel.classes?.[elementId]
                      ?? file.localModel.interfaces?.[elementId]
                      ?? file.localModel.enums?.[elementId];
                    if (el) el.packageName = targetPkgPath;
                  }
                },
              },
              ...(!isStandalone ? [{
                store: 'model' as const,
                mutate: (draft: any) => {
                  if (!draft.model) return;
                  const el = draft.model.classes[elementId]
                    ?? draft.model.interfaces[elementId]
                    ?? draft.model.enums[elementId];
                  if (el) { el.packageName = targetPkgPath; draft.model.updatedAt = Date.now(); }
                },
              }] : []),
            ],
            affectedElementIds: [elementId],
          });
          showToast(`Moved to "${targetPkgPath}".`);
          return;
        }
      }
    }

    handleMoveToPackage(elementId, targetPkgPath);
  }, [activeTabId, activeModel, isStandalone, viewNodes, pkgEffectivePaths, showToast, handleMoveToPackage]);

  const handleAddToCanvas = useCallback((pkgPath: string) => {
    if (!activeTabId || !activeModel) return;

    // Look up by effective path so nested packages (e.g. "s.dfdf") are found by their
    // resolved path rather than the raw IRPackage.name ("dfdf").
    const irPkg = Object.values(activeModel.packages ?? {}).find(
      (p) => (pkgEffectivePaths.get(p.id) ?? p.name) === pkgPath
    );

    if (irPkg) {
      if (viewNodes.some((vn) => vn.elementId === irPkg.id)) {
        showToast(`"${pkgPath}" is already on canvas.`);
        setContextMenu(null);
        return;
      }
      const newVNId = crypto.randomUUID();
      undoTransaction({
        label: `Add to canvas: ${pkgPath}`,
        scope: activeTabId,
        mutations: [{
          store: 'vfs',
          mutate: (draft: any) => {
            const file = draft.project?.nodes[activeTabId];
            if (!file || file.type !== 'FILE' || !isDiagramView(file.content)) return;
            file.content.nodes.push({ id: newVNId, elementId: irPkg.id, x: 200, y: 200, collapsed: false });
          },
        }],
        affectedElementIds: [irPkg.id],
      });
    } else {
      // String-based semantic package → promote to IRPackage + ViewNode.
      // Use only the last dotted segment as the canvas label (e.g. "s.sa" → "sa").
      // Also remove the source string entry to prevent ghost duplicates once the
      // new IRPackage picks up an effective path different from the raw string.
      const simpleName = pkgPath.split('.').pop()!;
      const newPkgId = crypto.randomUUID();
      const newVNId = crypto.randomUUID();

      if (isStandalone && activeTabId) {
        undoTransaction({
          label: `Add to canvas: ${pkgPath}`,
          scope: activeTabId,
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE') return;
              if (!node.localModel) return;
              node.localModel.packages[newPkgId] = {
                id: newPkgId, name: simpleName, kind: 'PACKAGE',
                packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
              };
              // Remove the string-based entry so it doesn't ghost back as a root node
              if (node.localModel.packageNames) {
                node.localModel.packageNames = node.localModel.packageNames.filter(
                  (n: string) => n !== pkgPath
                );
              }
              node.localModel.updatedAt = Date.now();
              if (isDiagramView(node.content)) {
                node.content.nodes.push({ id: newVNId, elementId: newPkgId, x: 200, y: 200, collapsed: false });
              }
            },
          }],
          affectedElementIds: [newPkgId],
        });
      } else {
        undoTransaction({
          label: `Add to canvas: ${pkgPath}`,
          scope: 'global',
          mutations: [
            {
              store: 'model',
              mutate: (draft: any) => {
                if (!draft.model) return;
                draft.model.packages[newPkgId] = {
                  id: newPkgId, name: simpleName, kind: 'PACKAGE',
                  packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
                };
                // Remove the string-based entry
                if (draft.model.packageNames) {
                  draft.model.packageNames = draft.model.packageNames.filter(
                    (n: string) => n !== pkgPath
                  );
                }
                draft.model.updatedAt = Date.now();
              },
            },
            {
              store: 'vfs',
              mutate: (draft: any) => {
                const file = draft.project?.nodes[activeTabId];
                if (!file || file.type !== 'FILE' || !isDiagramView(file.content)) return;
                file.content.nodes.push({ id: newVNId, elementId: newPkgId, x: 200, y: 200, collapsed: false });
              },
            },
          ],
          affectedElementIds: [newPkgId],
        });
      }
    }

    showToast(`"${pkgPath}" added to canvas.`);
    setContextMenu(null);
  }, [activeTabId, activeModel, isStandalone, viewNodes, pkgEffectivePaths, showToast]);

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

        {!activeModel || (totalElements === 0 && !hasPackages && !isAddingGlobal) ? (
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
                      viewNodeId={getViewNodeId(classNode.id)}
                      onDragStart={handleClassDragStart}
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
              getViewNodeId={getViewNodeId}
              onClassDragStart={handleClassDragStart}
              onDropOnPackage={handleDropOnPackage}
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
              {activeTabId && (
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-surface-hover"
                  onClick={() => handleAddToCanvas(contextMenu.packagePath!)}
                >
                  Add to Canvas
                </button>
              )}
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
          {(activeModel?.packageNames ?? []).map((pkgName) => (
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
