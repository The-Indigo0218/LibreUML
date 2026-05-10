import type { UmlClassNode, UmlPackage } from "../types/diagram.types";

/**
 * Synchronizes package hierarchy from flat package strings in class nodes.
 * 
 * CRITICAL: This function creates packages with FULL PATH in the `name` field
 * to match the exact structure created by manual package addition in the UI.
 * The buildPackageTree utility expects packages with full paths (e.g., "com.hospital.models")
 * and splits them to build the tree hierarchy.
 * 
 * This ensures that auto-generated packages are IDENTICAL to manually created ones,
 * allowing context menus and all UI interactions to work correctly.
 * 
 * @param classes - Array of UML class nodes with potential package declarations
 * @param currentPackages - Existing package nodes in the store
 * @returns Merged array of existing and newly created package nodes
 * 
 * @example
 * // Class with package: "com.hospital.models"
 * // Will create packages with FULL PATHS in name field:
 * const classes = [
 *   { data: { package: "com.hospital.models", label: "Patient" } },
 *   { data: { package: "com.hospital.staff", label: "Doctor" } }
 * ];
 * const packages = syncPackagesFromClasses(classes, []);
 * // Result: [
 * //   { id: "uuid-1", name: "com", parentId: undefined },
 * //   { id: "uuid-2", name: "com.hospital", parentId: undefined },
 * //   { id: "uuid-3", name: "com.hospital.models", parentId: undefined },
 * //   { id: "uuid-4", name: "com.hospital.staff", parentId: undefined }
 * // ]
 */
export function syncPackagesFromClasses(
  classes: UmlClassNode[],
  currentPackages: UmlPackage[]
): UmlPackage[] {
  // Create a map for fast lookup of existing packages
  // Key format: full package path (e.g., "com.hospital.models")
  const packageMap = new Map<string, UmlPackage>();
  
  // Index existing packages by their full name
  currentPackages.forEach(pkg => {
    packageMap.set(pkg.name, pkg);
  });

  // Collect all unique package paths that need to exist
  const requiredPaths = new Set<string>();

  classes.forEach(classNode => {
    const packageString = classNode.data.package;
    
    // Skip if no package or empty package
    if (!packageString || packageString.trim() === "") {
      return;
    }

    // Split package string into segments
    const segments = packageString
      .split(".")
      .map(seg => seg.trim())
      .filter(seg => seg !== "");

    // Skip if no valid segments
    if (segments.length === 0) {
      return;
    }

    // Build all intermediate paths
    // For "com.hospital.models", create: "com", "com.hospital", "com.hospital.models"
    let currentPath = "";
    segments.forEach((segment, index) => {
      currentPath = index === 0 ? segment : `${currentPath}.${segment}`;
      requiredPaths.add(currentPath);
    });
  });

  // Create packages for all required paths that don't exist yet
  requiredPaths.forEach(fullPath => {
    if (!packageMap.has(fullPath)) {
      // Create new package with FULL PATH in name field
      // This matches exactly how manual package creation works
      const newPackage: UmlPackage = {
        id: crypto.randomUUID(),
        name: fullPath,
        parentId: undefined, // parentId is not used in the current architecture
      };

      packageMap.set(fullPath, newPackage);
    }
  });

  // Convert map back to array
  return Array.from(packageMap.values());
}

/**
 * Validates that a package hierarchy is consistent.
 * Ensures that all parent references point to existing packages.
 * 
 * @param packages - Array of package nodes to validate
 * @returns True if hierarchy is valid, false otherwise
 */
export function validatePackageHierarchy(packages: UmlPackage[]): boolean {
  const packageIds = new Set(packages.map(p => p.id));
  
  for (const pkg of packages) {
    // If package has a parent, ensure parent exists
    if (pkg.parentId && !packageIds.has(pkg.parentId)) {
      console.warn(`Package "${pkg.name}" (${pkg.id}) has invalid parentId: ${pkg.parentId}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Builds the full package path for a given package node.
 * 
 * NOTE: In the current architecture, packages store their FULL PATH in the `name` field,
 * so this function simply returns the name directly. This function is kept for
 * backward compatibility and potential future refactoring.
 * 
 * @param packageId - ID of the package to get path for
 * @param packages - Array of all package nodes
 * @returns Full package path (e.g., "com.hospital.models")
 */
export function getFullPackagePath(
  packageId: string,
  packages: UmlPackage[]
): string {
  const pkg = packages.find(p => p.id === packageId);
  return pkg?.name || "";
}
