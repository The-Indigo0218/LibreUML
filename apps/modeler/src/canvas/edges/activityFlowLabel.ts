/**
 * Composes the label a CONTROL_FLOW/OBJECT_FLOW edge shows for its
 * `guard`/`weight` (A2, UML 2.5 §15.3). Pulled out as a pure function so the
 * string composition is unit-tested directly — `KonvaEdge` renders the
 * result verbatim, no logic of its own.
 */
export function formatActivityFlowLabel(
  guard: string | undefined,
  weight: string | undefined,
): string | undefined {
  const parts: string[] = [];
  if (guard && guard.trim()) parts.push(`[${guard.trim()}]`);
  if (weight && weight.trim()) parts.push(`{${weight.trim()}}`);
  return parts.length ? parts.join(' ') : undefined;
}
