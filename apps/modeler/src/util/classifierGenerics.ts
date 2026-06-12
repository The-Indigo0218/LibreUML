const GENERIC_RE = /^<.*>$/;

interface ClassifierLike {
  generics?: string;
  stereotypes?: string[];
}

export function readGenerics(el: ClassifierLike): string | undefined {
  if (el.generics) return el.generics;
  return el.stereotypes?.find((s) => GENERIC_RE.test(s));
}

export function realStereotypes(el: ClassifierLike): string[] {
  return (el.stereotypes ?? []).filter((s) => !GENERIC_RE.test(s));
}

export function isGenericToken(s: string): boolean {
  return GENERIC_RE.test(s);
}
