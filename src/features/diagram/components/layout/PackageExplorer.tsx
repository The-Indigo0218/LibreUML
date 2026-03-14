import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useReactFlow } from "reactflow";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Package, FolderPlus } from "lucide-react";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useProjectStore } from "../../../../store/project.store";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "../../../../store/settingsStore";
import { useUiStore } from "../../../../store/uiStore";
import { buildPackageTree } from "./packageExplorer/buildPackageTree";
import { PackageItem } from "./packageExplorer/PackageItem";
import { ClassItem } from "./packageExplorer/ClassItem";
import { ExplorerContextMenu } from "./packageExplorer/ExplorerContextMenu";
import { InlinePackageInput } from "./packageExplorer/InlinePackageInput";
import { DeletePackageModal } from "./packageExplorer/DeletePackageModal";
import type { UmlClassNode } from "../../types/diagram.types";
import type { ContextMenuState, DeletePackageState, TreeNode } from "./packageExplorer/types";

export default function PackageExplorer() {
  // SSOT Reactive Selection: Fetch IDs first to ensure referential stability
  const activeFileNodeIds = useWorkspaceStore(useShallow(s => {
    if (!s.activeFileId) return [];
    return s.getFile(s.activeFileId)?.nodeIds || [];
  }));

  // Fetch active file to get positionMap
  const activeFile = useWorkspaceStore(useShallow(s => {
    if (!s.activeFileId) return null;
    return s.getFile(s.activeFileId);
  }));

  // Extract positionMap from file metadata
  const positionMap = useMemo(() => {
    if (!activeFile) return {};
    return (activeFile.metadata as any)?.positionMap || {};
  }, [activeFile]);

  // Fetch ONLY the required nodes using the IDs
  const activeNodes = useProjectStore(useShallow(s => {
    return activeFileNodeIds.map(id => s.nodes[id]).filter(Boolean);
  }));

  // Transform SSOT domain nodes to UmlClassNode format for buildPackageTree
  // CRITICAL FIX: Use actual positions from positionMap instead of hardcoded (0,0)
  const transformedNodes: UmlClassNode[] = useMemo(() => {
    return activeNodes.map(node => {
      const position = positionMap[node.id] || { x: 0, y: 0 };
      return {
        id: node.id,
        type: "umlClass" as const,
        position: position, // Use actual position from positionMap
        data: {
          label: (node as any).name || "Unnamed",
          stereotype: node.type?.toLowerCase() as any,
          package: (node as any).package || "",
          attributes: (node as any).attributes || [],
          methods: (node as any).methods || [],
        },
      };
    });
  }, [activeNodes, positionMap]);

  // SSOT Actions: Wire up ProjectStore and WorkspaceStore
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const removeNodeFromFile = useWorkspaceStore((s) => s.removeNodeFromFile);
  const markFileDirty = useWorkspaceStore((s) => s.markFileDirty);
  
  const updateNode = useProjectStore((s) => s.updateNode);
  const removeNode = useProjectStore((s) => s.removeNode);
  const getEdgeIdsForNode = useProjectStore((s) => s.getEdgeIdsForNode);
  const removeEdgeFromFile = useWorkspaceStore((s) => s.removeEdgeFromFile);

  // Package Management: Store packages in file metadata
  const packages: Array<{ id: string; name: string }> = useMemo(() => {
    if (!activeFile) return [];
    return (activeFile.metadata as any)?.packages || [];
  }, [activeFile]);

  const addPackage = useCallback((name: string) => {
    if (!activeFileId || !activeFile) return;
    
    const newPackage = {
      id: crypto.randomUUID(),
      name: name,
    };
    
    const updatedPackages = [...packages, newPackage];
    
    updateFile(activeFileId, {
      metadata: {
        ...activeFile.metadata,
        packages: updatedPackages,
      } as any,
    });
    
    markFileDirty(activeFileId);
  }, [activeFileId, activeFile, packages, updateFile, markFileDirty]);

  const updatePackageName = useCallback((id: string, newName: string) => {
    if (!activeFileId || !activeFile) return;
    
    const oldPackage = packages.find(p => p.id === id);
    if (!oldPackage) return;
    
    const oldName = oldPackage.name;
    
    // Update package in metadata
    const updatedPackages = packages.map(p => 
      p.id === id ? { ...p, name: newName } : p
    );
    
    // Update all nodes that belong to this package
    activeNodes.forEach(node => {
      if ((node as any).package === oldName) {
        updateNode(node.id, { package: newName } as any);
      }
    });
    
    updateFile(activeFileId, {
      metadata: {
        ...activeFile.metadata,
        packages: updatedPackages,
      } as any,
    });
    
    markFileDirty(activeFileId);
  }, [activeFileId, activeFile, packages, activeNodes, updateNode, updateFile, markFileDirty]);

  const deletePackage = useCallback((id: string, deleteClasses: boolean) => {
    if (!activeFileId || !activeFile) return;
    
    const pkg = packages.find(p => p.id === id);
    if (!pkg) return;
    
    // Remove package from metadata
    const updatedPackages = packages.filter(p => p.id !== id);
    
    if (deleteClasses) {
      // Delete all nodes in this package
      const nodesToDelete = activeNodes.filter(node => 
        (node as any).package === pkg.name
      );
      
      nodesToDelete.forEach(node => {
        // Get connected edges
        const connectedEdgeIds = getEdgeIdsForNode(node.id);
        
        // Remove edges from file
        connectedEdgeIds.forEach(edgeId => {
          removeEdgeFromFile(activeFileId, edgeId);
        });
        
        // Remove node from file and store
        removeNodeFromFile(activeFileId, node.id);
        removeNode(node.id);
      });
    } else {
      // Just unassign the package from nodes
      activeNodes.forEach(node => {
        if ((node as any).package === pkg.name) {
          updateNode(node.id, { package: "" } as any);
        }
      });
    }
    
    updateFile(activeFileId, {
      metadata: {
        ...activeFile.metadata,
        packages: updatedPackages,
      } as any,
    });
    
    markFileDirty(activeFileId);
  }, [activeFileId, activeFile, packages, activeNodes, updateNode, removeNode, removeNodeFromFile, getEdgeIdsForNode, removeEdgeFromFile, updateFile, markFileDirty]);

  const updateNodeData = useCallback((nodeId: string, data: any) => {
    if (!activeFileId) return;
    
    // Update node name in ProjectStore
    updateNode(nodeId, { name: data.label } as any);
    markFileDirty(activeFileId);
  }, [activeFileId, updateNode, markFileDirty]);

  const deleteNode = useCallback((nodeId: string) => {
    if (!activeFileId) return;
    
    // Get connected edges
    const connectedEdgeIds = getEdgeIdsForNode(nodeId);
    
    // Remove edges from file
    connectedEdgeIds.forEach(edgeId => {
      removeEdgeFromFile(activeFileId, edgeId);
    });
    
    // Remove node from file and store (cascade delete handled in store)
    removeNodeFromFile(activeFileId, nodeId);
    removeNode(nodeId);
    
    markFileDirty(activeFileId);
  }, [activeFileId, removeNodeFromFile, removeNode, getEdgeIdsForNode, removeEdgeFromFile, markFileDirty]);
  
  const theme = useSettingsStore((s) => s.theme);

  // Merge explicit packages with implicit packages discovered from nodes
  const allPackages = useMemo(() => {
    const explicitPackages = new Map(packages.map(pkg => [pkg.name, pkg]));
    
    // Discover packages from nodes (XMI imports) and register ALL ancestor paths
    transformedNodes.forEach(node => {
      const pkgName = node.data.package;
      if (pkgName && pkgName.trim() !== "") {
        const segments = pkgName.split(".").filter(seg => seg.trim() !== "");
        let currentPath = "";
        
        // Register each ancestor path (e.g., "com", "com.hospital", "com.hospital.models")
        segments.forEach((segment) => {
          currentPath = currentPath ? `${currentPath}.${segment}` : segment;
          
          if (!explicitPackages.has(currentPath)) {
            // Create synthetic package entry for implicit packages
            explicitPackages.set(currentPath, {
              id: `implicit-${currentPath}`,
              name: currentPath,
            });
          }
        });
      }
    });
    
    return Array.from(explicitPackages.values());
  }, [packages, transformedNodes]);
  
  const { setCenter } = useReactFlow();
  const { t } = useTranslation();
  const { openClassEditor } = useUiStore();

  // Focus tracking: Use a ref to track the last focused node and timestamp
  const lastFocusRef = useRef<{ nodeId: string; timestamp: number } | null>(null);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [isAddingGlobal, setIsAddingGlobal] = useState(false);
  const [newPackageName, setNewPackageName] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [addingChildToPath, setAddingChildToPath] = useState<string | null>(null);
  const [deletePackageState, setDeletePackageState] = useState<DeletePackageState | null>(null);

  const packageTree = useMemo(() => {
    return buildPackageTree(allPackages, transformedNodes);
  }, [allPackages, transformedNodes]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  const handleToggle = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleClassToggle = (classId: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  };

  const handleClassClick = (nodeId: string) => {
    console.log('[PackageExplorer] handleClassClick called with nodeId:', nodeId);
    
    const node = transformedNodes.find((n) => n.id === nodeId);
    console.log('[PackageExplorer] Found node:', node ? { id: node.id, label: node.data.label, position: node.position } : 'NOT FOUND');
    
    if (node && node.position) {
      const x = node.position.x + (node.width || 250) / 2;
      const y = node.position.y + (node.height || 200) / 2;
      
      console.log('[PackageExplorer] Centering on position:', { x, y });
      
      // Force re-focus even if same node by checking timestamp
      const now = Date.now();
      const lastFocus = lastFocusRef.current;
      
      // Always update the ref and trigger focus
      lastFocusRef.current = { nodeId, timestamp: now };
      
      // If it's the same node clicked within 100ms, still re-trigger the animation
      setCenter(x, y, { zoom: 1.2, duration: 800 });
    } else {
      console.warn('[PackageExplorer] Cannot focus: node not found or has no position');
    }
  };

  const handleEditClass = (nodeId: string) => {
    openClassEditor(nodeId);
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

  const handleCancelAddChild = () => {
    setAddingChildToPath(null);
  };

  const handlePackageContextMenu = (e: React.MouseEvent, packagePath: string, packageName: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const pkg = allPackages.find(p => p.name === packagePath);
    if (!pkg) return;

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: "package",
      id: pkg.id,
      name: packageName,
      packagePath: packagePath,
    });
  };

  const handleClassContextMenu = (e: React.MouseEvent, classId: string, className: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: "class",
      id: classId,
      name: className,
    });
  };

  const handleRenameClick = () => {
    if (!contextMenu) return;
    
    if (contextMenu.type === "package") {
      setRenamingId(contextMenu.packagePath!);
    } else {
      setRenamingId(contextMenu.id);
    }
    
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
      const pkg = allPackages.find(p => p.id === contextMenu.id);
      if (!pkg) return;
      
      const classesInPackage = transformedNodes.filter(
        node => node.data.package === contextMenu.packagePath
      );
      
      setDeletePackageState({
        id: contextMenu.id,
        name: contextMenu.name,
        packagePath: contextMenu.packagePath!,
        hasClasses: classesInPackage.length > 0,
        classCount: classesInPackage.length,
      });
    } else {
      deleteNode(contextMenu.id);
    }
    
    setContextMenu(null);
  };

  const handleConfirmDeletePackage = (deleteClasses: boolean) => {
    if (!deletePackageState) return;
    
    deletePackage(deletePackageState.id, deleteClasses);
    setDeletePackageState(null);
  };

  const handleCancelDeletePackage = () => {
    setDeletePackageState(null);
  };

  const handleRenamePackage = (packagePath: string, newName: string) => {
    const pkg = allPackages.find(p => p.name === packagePath);
    if (pkg) {
      const pathSegments = packagePath.split(".");
      pathSegments[pathSegments.length - 1] = newName;
      const newFullPath = pathSegments.join(".");
      
      updatePackageName(pkg.id, newFullPath);
    }
    setRenamingId(null);
  };

  const handleRenameClass = (classId: string, newName: string) => {
    updateNodeData(classId, { label: newName });
    setRenamingId(null);
  };

  const handleCancelRename = () => {
    setRenamingId(null);
  };

  const totalClasses = transformedNodes.filter((n) => n.type === "umlClass").length;
  const unassignedClasses = packageTree.classes.length;

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
          <span>{allPackages.length} packages</span>
          <span>•</span>
          <span>{totalClasses} classes</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {transformedNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Package className="w-12 h-12 text-text-muted/30 mb-3" />
            <p className="text-sm text-text-muted">No packages or classes yet</p>
            <p className="text-xs text-text-muted/70 mt-1">
              Add classes to your diagram
            </p>
          </div>
        ) : (
          <>
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

            {unassignedClasses > 0 && (
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
                    (No Package)
                  </span>
                  <span className="text-[10px] text-text-muted bg-surface-secondary px-1.5 py-0.5 rounded">
                    {unassignedClasses}
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
              node={packageTree}
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

      <ExplorerContextMenu
        contextMenu={contextMenu}
        onRename={handleRenameClick}
        onDelete={handleDeleteClick}
        onAddChild={handleAddChildClick}
      />

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
