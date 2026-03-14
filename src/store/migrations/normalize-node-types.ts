/**
 * Migration Utility: Normalize Node Types
 * 
 * This utility fixes nodes that were created with lowercase types (e.g., "class", "interface")
 * and converts them to the correct uppercase domain types (e.g., "CLASS", "INTERFACE").
 * 
 * This issue occurred when XMI imports or other node creation paths didn't properly
 * convert stereotypes to uppercase domain types.
 */

import type { DomainNode } from '../../core/domain/models/nodes';

/**
 * Mapping from lowercase/mixed-case types to correct uppercase domain types
 */
const TYPE_NORMALIZATION_MAP: Record<string, string> = {
  'class': 'CLASS',
  'Class': 'CLASS',
  'interface': 'INTERFACE',
  'Interface': 'INTERFACE',
  'abstract': 'ABSTRACT_CLASS',
  'Abstract': 'ABSTRACT_CLASS',
  'abstractClass': 'ABSTRACT_CLASS',
  'AbstractClass': 'ABSTRACT_CLASS',
  'enum': 'ENUM',
  'Enum': 'ENUM',
  'note': 'NOTE',
  'Note': 'NOTE',
  'actor': 'ACTOR',
  'Actor': 'ACTOR',
  'useCase': 'USE_CASE',
  'UseCase': 'USE_CASE',
  'use_case': 'USE_CASE',
  'systemBoundary': 'SYSTEM_BOUNDARY',
  'SystemBoundary': 'SYSTEM_BOUNDARY',
  'system_boundary': 'SYSTEM_BOUNDARY',
};

/**
 * Normalizes a single node's type to uppercase domain type
 */
export function normalizeNodeType(node: DomainNode): DomainNode {
  const currentType = node.type as string;
  const normalizedType = TYPE_NORMALIZATION_MAP[currentType] || currentType;
  
  if (normalizedType !== currentType) {
    console.log(`[Migration] Normalizing node ${node.id}: "${currentType}" -> "${normalizedType}"`);
    return {
      ...node,
      type: normalizedType as any,
      updatedAt: Date.now(),
    };
  }
  
  return node;
}

/**
 * Normalizes all nodes in a dictionary
 */
export function normalizeAllNodeTypes(
  nodes: Record<string, DomainNode>
): Record<string, DomainNode> {
  const normalizedNodes: Record<string, DomainNode> = {};
  let changeCount = 0;
  
  for (const [id, node] of Object.entries(nodes)) {
    const normalizedNode = normalizeNodeType(node);
    normalizedNodes[id] = normalizedNode;
    
    if (normalizedNode !== node) {
      changeCount++;
    }
  }
  
  if (changeCount > 0) {
    console.log(`[Migration] Normalized ${changeCount} node(s) with incorrect types`);
  }
  
  return normalizedNodes;
}

/**
 * Checks if a node type needs normalization
 */
export function needsTypeNormalization(node: DomainNode): boolean {
  const currentType = node.type as string;
  const normalizedType = TYPE_NORMALIZATION_MAP[currentType];
  return normalizedType !== undefined && normalizedType !== currentType;
}
