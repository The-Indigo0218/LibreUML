import { useMemo } from 'react';
import { useModelStore } from '../../../store/model.store';

interface ModelValidationResult {
  errorCount: number;
  errors: string[];
  warningCount: number;
  warnings: string[];
}

export function useModelValidation(): ModelValidationResult {
  const model = useModelStore((s) => s.model);

  return useMemo(() => {
    if (!model) {
      return { errorCount: 0, errors: [], warningCount: 0, warnings: [] };
    }

    const errors: string[] = [];

    const resolvePackage = (packageId?: string): string =>
      packageId ? (model.packages[packageId]?.name ?? '') : '';

    // ── Duplicate elements (same name + package across classes/interfaces/enums) ──
    const elementSeen = new Map<string, number>();

    const trackElement = (name: string, packageId?: string) => {
      const pkg = resolvePackage(packageId);
      const key = `${name.trim()}\x00${pkg}`;
      elementSeen.set(key, (elementSeen.get(key) ?? 0) + 1);
    };

    for (const cls of Object.values(model.classes)) trackElement(cls.name, cls.packageId);
    for (const iface of Object.values(model.interfaces)) trackElement(iface.name, iface.packageId);
    for (const enm of Object.values(model.enums)) trackElement(enm.name, enm.packageId);

    for (const [key, count] of elementSeen) {
      if (count > 1) {
        const [name, pkg] = key.split('\x00');
        errors.push(
          pkg
            ? `Duplicate element: ${name} in package ${pkg}`
            : `Duplicate element: ${name} (no package)`,
        );
      }
    }

    // ── Duplicate attributes within a classifier (same name) ──────────────────
    const checkDuplicateAttributes = (ownerName: string, attributeIds: string[]) => {
      const seen = new Map<string, number>();
      for (const id of attributeIds) {
        const attr = model.attributes[id];
        if (!attr) continue;
        const name = attr.name.trim();
        seen.set(name, (seen.get(name) ?? 0) + 1);
      }
      for (const [name, count] of seen) {
        if (count > 1) {
          errors.push(`Duplicate attribute: ${name} in ${ownerName}`);
        }
      }
    };

    // ── Duplicate operations within a classifier (same name + param types) ────
    const checkDuplicateOperations = (ownerName: string, operationIds: string[]) => {
      const seen = new Map<string, number>();
      for (const id of operationIds) {
        const op = model.operations[id];
        if (!op) continue;
        const paramTypes = op.parameters.map((p) => p.type).join(',');
        const sig = `${op.name.trim()}(${paramTypes})`;
        seen.set(sig, (seen.get(sig) ?? 0) + 1);
      }
      for (const [sig, count] of seen) {
        if (count > 1) {
          errors.push(`Duplicate operation: ${sig} in ${ownerName}`);
        }
      }
    };

    for (const cls of Object.values(model.classes)) {
      checkDuplicateAttributes(cls.name, cls.attributeIds);
      checkDuplicateOperations(cls.name, cls.operationIds);
    }
    for (const iface of Object.values(model.interfaces)) {
      checkDuplicateOperations(iface.name, iface.operationIds);
    }

    return { errorCount: errors.length, errors, warningCount: 0, warnings: [] };
  }, [model]);
}
