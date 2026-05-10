import type { UmlClassNode } from "../../../types/diagram.types";
import type { TreeNode } from "./types";

export function buildPackageTree(
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

  packages.forEach((pkg) => {
    if (!pkg.name || pkg.name.trim() === "") return;
    
    const segments = pkg.name.split(".").filter(seg => seg.trim() !== "");
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

  nodes.forEach((node) => {
    if (node.data.package && node.data.package.trim() !== "") {
      const segments = node.data.package.split(".").filter(seg => seg.trim() !== "");
      let currentNode = root;

      segments.forEach((segment) => {
        if (!currentNode.children.has(segment)) {
          const pathSoFar = segments.slice(0, segments.indexOf(segment) + 1).join(".");
          currentNode.children.set(segment, {
            name: segment,
            fullPath: pathSoFar,
            children: new Map(),
            classes: [],
            isExpanded: false,
          });
        }
        currentNode = currentNode.children.get(segment)!;
      });

      currentNode.classes.push(node);
    } else {
      root.classes.push(node);
    }
  });

  return root;
}
