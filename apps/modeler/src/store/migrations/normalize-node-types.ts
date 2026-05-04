/**
 * Migration Utility: Normalize Node Types
 *
 * Fixes nodes with lowercase types (e.g., "class", "interface") by converting them
 * to uppercase domain types (e.g., "CLASS", "INTERFACE").
 */

import type { DomainNode } from '../../core/domain/models/nodes';

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

export function normalizeNodeType(node: DomainNode): DomainNode {
  const currentType = node.type as string;
  const normalizedType = TYPE_NORMALIZATION_MAP[currentType] || currentType;

  if (normalizedType !== currentType) {
    return {
      ...node,
      type: normalizedType as any,
      updatedAt: Date.now(),
    };
  }

  return node;
}

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


  return normalizedNodes;
}

export function needsTypeNormalization(node: DomainNode): boolean {
  const currentType = node.type as string;
  const normalizedType = TYPE_NORMALIZATION_MAP[currentType];
  return normalizedType !== undefined && normalizedType !== currentType;
}
