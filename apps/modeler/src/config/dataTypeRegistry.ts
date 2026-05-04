export type SupportedLanguage = 'uml' | 'java';

// ISO/IEC 19505-1:2012 (UML 2.5) PrimitiveTypes package
export const UML_2_5_PRIMITIVES = [
  'Boolean',
  'Integer',
  'Real',
  'String',
  'UnlimitedNatural',
] as const;

export type UmlPrimitive = (typeof UML_2_5_PRIMITIVES)[number];

export const JAVA_TYPES = [
  // Primitives
  'int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short',
  // Boxed
  'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Character', 'Byte', 'Short',
  // Core
  'String', 'Object', 'void',
  // Collections (raw)
  'List', 'ArrayList', 'LinkedList',
  'Set', 'HashSet', 'TreeSet',
  'Map', 'HashMap', 'TreeMap',
  'Queue', 'Deque', 'ArrayDeque',
  // Generic collection types
  'List<String>', 'List<Integer>', 'List<Long>', 'List<Double>', 'List<Object>',
  'ArrayList<String>', 'ArrayList<Integer>', 'ArrayList<Object>',
  'LinkedList<String>', 'LinkedList<Integer>',
  'Set<String>', 'Set<Integer>',
  'HashSet<String>', 'HashSet<Integer>',
  'Map<String, String>', 'Map<String, Integer>', 'Map<String, Object>',
  'Map<Integer, String>',
  'HashMap<String, String>', 'HashMap<String, Integer>', 'HashMap<String, Object>',
  'Optional<String>', 'Optional<Integer>',
  // Dates / Time
  'Date', 'LocalDate', 'LocalDateTime', 'LocalTime', 'Instant',
] as const;

export type JavaType = (typeof JAVA_TYPES)[number];

const REGISTRY: Record<SupportedLanguage, readonly string[]> = {
  uml: UML_2_5_PRIMITIVES,
  java: JAVA_TYPES,
};

export function getDataTypes(language: string): readonly string[] {
  return REGISTRY[language as SupportedLanguage] ?? UML_2_5_PRIMITIVES;
}
