import { useState, useMemo } from "react";
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen,
  Package
} from "lucide-react";
import { useDiagramStore } from "../../../../store/diagramStore";
import type { UmlClassNode } from "../../types/diagram.types";

// Tree node structure for hierarchical package representation
interface TreeNode {
  name: string;
  fullPath: string;
  children: Map<string, TreeNode>;
  classes: UmlClassNode[];
  isExpanded: boolean;
}

/**
 * Builds a hierarchical tree structure from flat package names.
 * Converts ["com.hospital.models", "com.hospital.services"] into nested tree.
 */
function buildPackageTree(
  packages: { name: string }[],
  nodes: UmlClassNode[]
): TreeNode {
  const root: TreeNode = {
    name: "root",
    fullPath: "",
    children: new Map(),
    classes: [],
    isExpanded: true,
  };

  // Build tree structure from package names
  packages.forEach((pkg) => {
    const segments = pkg.name.split(".");
    let currentNode = root;
    let currentPath = "";

    segments.forEach((segment) => {
      currentPath = currentPath ? `${currentPath}.${segment}` : segment;

      if (!currentNode.children.has(segment)) {
        currentNode.children.set(segment, {
          name: segment,
          fullPath: currentPath,
          children: new Map(),
          classes: [],
          isExpanded: false,
        });
      }

      currentNode = currentNode.children.get(segment)!;
    });
  });

  // Assign classes to their respective packages
  nodes.forEach((node) => {
    if (node.data.package) {
      const segments = node.data.package.split(".");
      let currentNode = root;

      segments.forEach((segment) => {
        const child = currentNode.children.get(segment);
        if (child) {
          currentNode = child;
        }
      });

      currentNode.classes.push(node);
    } else {
      // Classes without package go to root
      root.classes.push(node);
    }
  });

  return root;
}

/**
 * Recursive tree node component
 */
interface TreeNodeComponentProps {
  node: TreeNode;
  level: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onClassClick?: (nodeId: string) => void;
}

function TreeNodeComponent({
  node,
  level,
  expandedPaths,
  onToggle,
  onClassClick,
}: TreeNodeComponentProps) {
  const isExpanded = expandedPaths.has(node.fullPath);
  const hasChildren = node.children.size > 0;
  const hasClasses = node.classes.length > 0;
  const isEmpty = !hasChildren && !hasClasses;

  // Stereotype icon colors
  const getStereotypeIcon = (stereotype: string) => {
    switch (stereotype) {
      case "interface":
        return (
          <div className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center text-[10px] font-bold text-green-400">
            I
          </div>
        );
      case "abstract":
        return (
          <div className="w-4 h-4 rounded-full bg-purple-500/20 border border-purple-500 flex items-center justify-center text-[10px] font-bold text-purple-400">
            A
          </div>
        );
      case "enum":
        return (
          <div className="w-4 h-4 rounded-full bg-yellow-500/20 border border-yellow-500 flex items-center justify-center text-[10px] font-bold text-yellow-400">
            E
          </div>
        );
      default:
        return (
          <div className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center text-[10px] font-bold text-blue-400">
            C
          </div>
        );
    }
  };

  return (
    <div>
      {/* Package/Folder Row */}
      {node.name !== "root" && (
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-surface-hover rounded cursor-pointer group transition-colors"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => onToggle(node.fullPath)}
        >
          {/* Expand/Collapse Icon */}
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

          {/* Folder Icon */}
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-yellow-500" />
          ) : (
            <Folder className="w-4 h-4 text-yellow-600" />
          )}

          {/* Package Name */}
          <span className="text-sm text-text-secondary group-hover:text-text-primary flex-1 truncate">
            {node.name}
          </span>

          {/* Class Count Badge */}
          {hasClasses && (
            <span className="text-[10px] text-text-muted bg-surface-secondary px-1.5 py-0.5 rounded">
              {node.classes.length}
            </span>
          )}

          {/* Empty Package Indicator */}
          {isEmpty && (
            <span className="text-[10px] text-text-muted italic">empty</span>
          )}
        </div>
      )}

      {/* Expanded Content */}
      {(isExpanded || node.name === "root") && (
        <>
          {/* Render Classes */}
          {node.classes.map((classNode) => (
            <div
              key={classNode.id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-hover rounded cursor-pointer group transition-colors"
              style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
              onClick={() => onClassClick?.(classNode.id)}
            >
              <div className="w-4" />
              {getStereotypeIcon(classNode.data.stereotype)}
              <span className="text-sm text-text-primary group-hover:text-uml-class-border truncate flex-1">
                {classNode.data.label}
              </span>
              {classNode.data.isMain && (
                <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded font-bold">
                  MAIN
                </span>
              )}
            </div>
          ))}

          {/* Render Child Packages */}
          {Array.from(node.children.values())
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((childNode) => (
              <TreeNodeComponent
                key={childNode.fullPath}
                node={childNode}
                level={level + 1}
                expandedPaths={expandedPaths}
                onToggle={onToggle}
                onClassClick={onClassClick}
              />
            ))}
        </>
      )}
    </div>
  );
}

/**
 * Main Package Explorer Component
 */
export default function PackageExplorer() {
  const packages = useDiagramStore((s) => s.packages);
  const nodes = useDiagramStore((s) => s.nodes);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Build tree structure
  const packageTree = useMemo(() => {
    return buildPackageTree(packages, nodes as UmlClassNode[]);
  }, [packages, nodes]);

  // Toggle expand/collapse
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

  // Handle class click (could navigate to node, select it, etc.)
  const handleClassClick = (nodeId: string) => {
    // TODO: Implement class selection/navigation
    console.log("Class clicked:", nodeId);
  };

  // Count total classes
  const totalClasses = nodes.filter((n) => n.type === "umlClass").length;
  const unassignedClasses = packageTree.classes.length;

  return (
    <div className="flex flex-col h-full bg-surface-primary border-r border-surface-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-4 h-4 text-uml-class-border" />
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
            Packages
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>{packages.length} packages</span>
          <span>•</span>
          <span>{totalClasses} classes</span>
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {packages.length === 0 && totalClasses === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Package className="w-12 h-12 text-text-muted/30 mb-3" />
            <p className="text-sm text-text-muted">No packages or classes yet</p>
            <p className="text-xs text-text-muted/70 mt-1">
              Add classes to your diagram
            </p>
          </div>
        ) : (
          <>
            {/* Unassigned Classes (No Package) */}
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
                  <Folder className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-text-secondary group-hover:text-text-primary flex-1">
                    (No Package)
                  </span>
                  <span className="text-[10px] text-text-muted bg-surface-secondary px-1.5 py-0.5 rounded">
                    {unassignedClasses}
                  </span>
                </div>

                {expandedPaths.has("__unassigned__") &&
                  packageTree.classes.map((classNode) => (
                    <div
                      key={classNode.id}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-hover rounded cursor-pointer group transition-colors ml-4"
                      onClick={() => handleClassClick(classNode.id)}
                    >
                      <div className="w-4" />
                      {classNode.data.stereotype === "interface" ? (
                        <div className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center text-[10px] font-bold text-green-400">
                          I
                        </div>
                      ) : classNode.data.stereotype === "abstract" ? (
                        <div className="w-4 h-4 rounded-full bg-purple-500/20 border border-purple-500 flex items-center justify-center text-[10px] font-bold text-purple-400">
                          A
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center text-[10px] font-bold text-blue-400">
                          C
                        </div>
                      )}
                      <span className="text-sm text-text-primary group-hover:text-uml-class-border truncate flex-1">
                        {classNode.data.label}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {/* Package Tree */}
            <TreeNodeComponent
              node={packageTree}
              level={0}
              expandedPaths={expandedPaths}
              onToggle={handleToggle}
              onClassClick={handleClassClick}
            />
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t border-surface-border">
        <button
          className="w-full text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover py-2 rounded transition-colors"
          onClick={() => {
            // Expand all packages
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
    </div>
  );
}
