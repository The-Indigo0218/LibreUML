import type { stereotype, UmlRelationType } from "../features/diagram/types/diagram.types";

const PACKAGE_RELATION_TYPES = new Set<UmlRelationType>([
  "dependency",
  "package_import",
  "package_access",
  "package_merge",
]);

const RELATIONSHIP_RULES: Record<
  UmlRelationType,
  {
    sources: stereotype[];
    targets: stereotype[];
    validator?: (source: stereotype, target: stereotype) => boolean;
  }
> = {
  inheritance: {
    sources: ["class", "abstract", "interface"],
    targets: ["class", "abstract", "interface"],
    validator: (source, target) => {
      return (source === "interface") === (target === "interface");
    },
  },
  implementation: {
    sources: ["class", "abstract", "enum"],
    targets: ["interface"],
  },
  association: {
    sources: ["class", "abstract", "interface", "enum"],
    targets: ["class", "abstract", "interface", "enum"],
  },
  dependency: {
    sources: ["class", "abstract", "interface", "enum", "package"],
    targets: ["class", "abstract", "interface", "enum", "package"],
  },
  aggregation: {
    sources: ["class", "abstract", "interface", "enum"],
    targets: ["class", "abstract", "interface", "enum"],
  },
  composition: {
    sources: ["class", "abstract", "interface", "enum"],
    targets: ["class", "abstract", "interface", "enum"],
  },
  package_import: {
    sources: ["package"],
    targets: ["package"],
  },
  package_access: {
    sources: ["package"],
    targets: ["package"],
  },
  package_merge: {
    sources: ["package"],
    targets: ["package"],
  },
};

/**
 * Validates if a connection is semantically correct according to UML rules.
 */
export const validateConnection = (
  sourceStereotype: stereotype,
  targetStereotype: stereotype,
  relationType: UmlRelationType
): boolean => {
  if (sourceStereotype === "note" || targetStereotype === "note") return true;

  if (sourceStereotype === "package" && targetStereotype === "package") {
    return PACKAGE_RELATION_TYPES.has(relationType);
  }

  const rule = RELATIONSHIP_RULES[relationType];
  if (!rule) return false;

  const validSource = rule.sources.includes(sourceStereotype);
  const validTarget = rule.targets.includes(targetStereotype);

  if (!validSource || !validTarget) return false;

  if (rule.validator) {
    return rule.validator(sourceStereotype, targetStereotype);
  }

  return true;
};