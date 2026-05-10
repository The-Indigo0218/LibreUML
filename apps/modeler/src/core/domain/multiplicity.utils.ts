export const MULTIPLICITY_PRESETS = ['1', '*', '0..1', '1..*', '0..*'] as const;

export type MultiplicityPreset = typeof MULTIPLICITY_PRESETS[number];

export function isValidMultiplicity(v: string | undefined): boolean {
  if (!v) return true;
  const s = v.trim();
  if (!s) return true;
  if ((MULTIPLICITY_PRESETS as readonly string[]).includes(s)) return true;
  // accepts: 1, 5, 1..3, 1..*, *
  return /^(\*|\d+|\d+\.\.(?:\*|\d+))$/.test(s);
}
