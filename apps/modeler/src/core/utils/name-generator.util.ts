import type { DomainNode } from "../domain/models/nodes";

/**
 * Gets the next default name for a newly created node.
 * Scans the existing nodes in the ProjectStore to find the highest trailing number
 * for the given base name (e.g., "Class 1", "Class 2") and returns the next available.
 * 
 * @param nodes Array of all current DomainNodes in the system
 * @param type The type constraint or prefix to use (e.g., "Class", "Interface", "Enum")
 * @returns A unique default name string
 */
export function getNextDefaultName(nodes: DomainNode[], type: string): string {
  // Normalize the prefix to Title Case (e.g. "CLASS" -> "Class")
  const prefix = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  
  // Regex to match exact pattern "Prefix N"
  const pattern = new RegExp(`^${prefix}\\s+(\\d+)$`);
  
  let maxNumber = 0;
  
  for (const node of nodes) {
    const nodeName = (node as any).name;
    if (typeof nodeName === 'string') {
      const match = nodeName.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  }
  
  return `${prefix} ${maxNumber + 1}`;
}
