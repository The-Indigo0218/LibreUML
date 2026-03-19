export interface ParsedType {
  baseName: string;
  isCollection: boolean;
}

const COLLECTION_WRAPPERS = new Set([
  'List', 'Array', 'Collection', 'Set', 'Queue',
  'Deque', 'LinkedList', 'ArrayList', 'HashSet', 'TreeSet',
  'SortedSet', 'Stack', 'Vector', 'Iterable', 'Seq',
]);

export function parseAttributeType(raw: string): ParsedType {
  const trimmed = raw.trim();

  if (trimmed.endsWith('[]')) {
    return { baseName: trimmed.slice(0, -2).trim(), isCollection: true };
  }

  const lt = trimmed.indexOf('<');
  if (lt !== -1 && trimmed.endsWith('>')) {
    const outer = trimmed.slice(0, lt).trim();
    if (COLLECTION_WRAPPERS.has(outer)) {
      return { baseName: trimmed.slice(lt + 1, -1).trim(), isCollection: true };
    }
  }

  return { baseName: trimmed, isCollection: false };
}
