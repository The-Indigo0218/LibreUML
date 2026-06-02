/**
 * relationShortcuts — single-key keyboard shortcuts for activating relation /
 * connection tools (R8 of the UX overhaul).
 *
 * Single source of truth shared by:
 *   - useRelationShortcuts (canvas keydown listener)
 *   - ToolPalette (tooltip / key hint on each connection item)
 *   - KeyboardShortcutsModal (help overlay listing)
 *
 * Diagram-awareness: each key maps to one or more *candidate* tool ids. At
 * runtime we pick the first candidate that exists in the active diagram's
 * registry (`registry.tools.edges[].id`). This lets a single key (`g`) drive
 * the conceptually-equivalent tool whose id differs per diagram — e.g.
 * Class diagram uses `inheritance`, Use Case diagram uses `generalization`.
 *
 * Keys are plain single characters (no modifier) so they never collide with the
 * Ctrl/Cmd/Alt-based global shortcuts in useKeyboardShortcuts. Callers MUST
 * guard against firing while a text input / inline editor has focus.
 */

/** key (lowercase) → ordered candidate tool ids (first available wins). */
export const RELATION_KEY_TO_TOOLS: Record<string, readonly string[]> = {
  a: ['association'],
  g: ['inheritance', 'generalization'],
  r: ['implementation'],
  d: ['dependency'],
  o: ['aggregation'],
  c: ['composition'],
  i: ['include'],
  x: ['extend'],
  // Sequence-diagram messages
  '1': ['message_sync'],
  '2': ['message_async'],
  '3': ['message_reply'],
  '4': ['message_create'],
  '5': ['message_destroy'],
};

/** Reverse lookup: tool id → the key that activates it. */
export const TOOL_TO_RELATION_KEY: Record<string, string> = Object.entries(
  RELATION_KEY_TO_TOOLS,
).reduce<Record<string, string>>((acc, [key, ids]) => {
  for (const id of ids) acc[id] = key;
  return acc;
}, {});

/**
 * Resolves a pressed key to the tool id that should be activated for the
 * current diagram, or null if the key is not a relation shortcut or no
 * candidate is available in this diagram.
 */
export function resolveRelationShortcut(
  key: string,
  availableToolIds: readonly string[],
): string | null {
  const candidates = RELATION_KEY_TO_TOOLS[key.toLowerCase()];
  if (!candidates) return null;
  for (const id of candidates) {
    if (availableToolIds.includes(id)) return id;
  }
  return null;
}

/** Returns the display key (uppercase) for a tool id, or null if none. */
export function getRelationShortcutKey(toolId: string): string | null {
  const k = TOOL_TO_RELATION_KEY[toolId];
  return k ? k.toUpperCase() : null;
}
