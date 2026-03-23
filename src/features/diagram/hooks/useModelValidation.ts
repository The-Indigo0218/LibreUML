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

    // ── Duplicate elements (same FQN: name + package across classes/interfaces/enums) ──
    const elementSeen = new Map<string, number>();

    const trackElement = (name: string, packageName?: string) => {
      const pkg = packageName?.trim() ?? '';
      const key = `${name.trim()}\x00${pkg}`;
      elementSeen.set(key, (elementSeen.get(key) ?? 0) + 1);
    };

    const internalClasses = Object.values(model.classes).filter((c) => !c.isExternal);
    const internalInterfaces = Object.values(model.interfaces).filter((i) => !i.isExternal);
    const internalEnums = Object.values(model.enums).filter((e) => !e.isExternal);

    for (const cls of internalClasses) trackElement(cls.name, cls.packageName);
    for (const iface of internalInterfaces) trackElement(iface.name, iface.packageName);
    for (const enm of internalEnums) trackElement(enm.name, enm.packageName);

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

    // ── Duplicate operations within a classifier (same name + param types + return type) ──
    const checkDuplicateOperations = (ownerName: string, operationIds: string[]) => {
      const seen = new Map<string, number>();
      for (const id of operationIds) {
        const op = model.operations[id];
        if (!op) continue;
        const paramTypes = op.parameters.map((p) => p.type).join(',');
        const sig = `${op.name.trim()}(${paramTypes}):${op.returnType ?? 'void'}`;
        seen.set(sig, (seen.get(sig) ?? 0) + 1);
      }
      for (const [sig, count] of seen) {
        if (count > 1) {
          errors.push(`Duplicate operation: ${sig} in ${ownerName}`);
        }
      }
    };

    for (const cls of internalClasses) {
      checkDuplicateAttributes(cls.name, cls.attributeIds);
      checkDuplicateOperations(cls.name, cls.operationIds);
    }
    for (const iface of internalInterfaces) {
      checkDuplicateOperations(iface.name, iface.operationIds);
    }

    return { errorCount: errors.length, errors, warningCount: 0, warnings: [] };
  }, [model]);
}
