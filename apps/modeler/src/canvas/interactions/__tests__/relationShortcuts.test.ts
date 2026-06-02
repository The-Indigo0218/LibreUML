import { describe, it, expect } from 'vitest';
import {
  resolveRelationShortcut,
  getRelationShortcutKey,
  RELATION_KEY_TO_TOOLS,
  TOOL_TO_RELATION_KEY,
} from '../relationShortcuts';

// Edge tool ids as defined per diagram in the registry (diagram-registry.ts).
const CLASS_EDGES = ['association', 'inheritance', 'implementation', 'dependency', 'aggregation', 'composition'];
const USE_CASE_EDGES = ['association', 'include', 'extend', 'generalization'];
const SEQUENCE_EDGES = ['message_sync', 'message_async', 'message_reply', 'message_create', 'message_destroy'];

describe('resolveRelationShortcut', () => {
  it('resolves class-diagram relation keys to their tool ids', () => {
    expect(resolveRelationShortcut('a', CLASS_EDGES)).toBe('association');
    expect(resolveRelationShortcut('r', CLASS_EDGES)).toBe('implementation');
    expect(resolveRelationShortcut('d', CLASS_EDGES)).toBe('dependency');
    expect(resolveRelationShortcut('o', CLASS_EDGES)).toBe('aggregation');
    expect(resolveRelationShortcut('c', CLASS_EDGES)).toBe('composition');
  });

  it('maps "g" to inheritance in class diagrams and generalization in use-case diagrams', () => {
    expect(resolveRelationShortcut('g', CLASS_EDGES)).toBe('inheritance');
    expect(resolveRelationShortcut('g', USE_CASE_EDGES)).toBe('generalization');
  });

  it('resolves use-case-only relation keys', () => {
    expect(resolveRelationShortcut('i', USE_CASE_EDGES)).toBe('include');
    expect(resolveRelationShortcut('x', USE_CASE_EDGES)).toBe('extend');
  });

  it('resolves sequence message keys', () => {
    expect(resolveRelationShortcut('1', SEQUENCE_EDGES)).toBe('message_sync');
    expect(resolveRelationShortcut('5', SEQUENCE_EDGES)).toBe('message_destroy');
  });

  it('is case-insensitive on the pressed key', () => {
    expect(resolveRelationShortcut('A', CLASS_EDGES)).toBe('association');
    expect(resolveRelationShortcut('G', USE_CASE_EDGES)).toBe('generalization');
  });

  it('returns null when the key is not a relation shortcut', () => {
    expect(resolveRelationShortcut('z', CLASS_EDGES)).toBeNull();
    expect(resolveRelationShortcut('9', CLASS_EDGES)).toBeNull();
  });

  it('returns null when no candidate tool exists in the active diagram', () => {
    // "i"/"x" (include/extend) are not class-diagram tools.
    expect(resolveRelationShortcut('i', CLASS_EDGES)).toBeNull();
    expect(resolveRelationShortcut('x', CLASS_EDGES)).toBeNull();
    // messages are not class-diagram tools.
    expect(resolveRelationShortcut('1', CLASS_EDGES)).toBeNull();
  });
});

describe('getRelationShortcutKey', () => {
  it('returns the uppercase key for known tool ids', () => {
    expect(getRelationShortcutKey('association')).toBe('A');
    expect(getRelationShortcutKey('inheritance')).toBe('G');
    expect(getRelationShortcutKey('generalization')).toBe('G');
    expect(getRelationShortcutKey('implementation')).toBe('R');
    expect(getRelationShortcutKey('message_sync')).toBe('1');
  });

  it('returns null for unknown tool ids', () => {
    expect(getRelationShortcutKey('note')).toBeNull();
    expect(getRelationShortcutKey('nonexistent')).toBeNull();
  });
});

describe('mapping integrity', () => {
  it('reverse map is consistent with the forward map', () => {
    for (const [key, ids] of Object.entries(RELATION_KEY_TO_TOOLS)) {
      for (const id of ids) {
        expect(TOOL_TO_RELATION_KEY[id]).toBe(key);
      }
    }
  });
});
