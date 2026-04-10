/**
 * Utility functions for handling package names and nested package structures.
 */

/**
 * Given a qualified package name like "as2.as.test", returns all intermediate
 * package paths that should exist: ["as2", "as2.as", "as2.as.test"]
 * 
 * This ensures that when a user creates an element with package "as2.as.test",
 * all parent packages are automatically created.
 * 
 * @param qualifiedName - The full package name (e.g., "as2.as.test")
 * @returns Array of all package paths from root to leaf
 * 
 * @example
 * getPackageHierarchy("as2.as.test") // ["as2", "as2.as", "as2.as.test"]
 * getPackageHierarchy("com.example") // ["com", "com.example"]
 * getPackageHierarchy("single") // ["single"]
 */
export function getPackageHierarchy(qualifiedName: string): string[] {
  if (!qualifiedName || !qualifiedName.trim()) {
    return [];
  }

  const parts = qualifiedName.trim().split('.');
  const hierarchy: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    hierarchy.push(parts.slice(0, i + 1).join('.'));
  }

  return hierarchy;
}

/**
 * Ensures all intermediate packages exist in the given package names array.
 * Returns a new array with all necessary packages added.
 * 
 * @param existingPackages - Current array of package names
 * @param newPackageName - The package name to ensure (with all its parents)
 * @returns New array with all packages including intermediates
 * 
 * @example
 * ensurePackageHierarchy(["com"], "com.example.test")
 * // Returns: ["com", "com.example", "com.example.test"]
 */
export function ensurePackageHierarchy(
  existingPackages: string[],
  newPackageName: string
): string[] {
  const hierarchy = getPackageHierarchy(newPackageName);
  const packageSet = new Set(existingPackages);
  
  hierarchy.forEach(pkg => packageSet.add(pkg));
  
  return Array.from(packageSet).sort();
}
