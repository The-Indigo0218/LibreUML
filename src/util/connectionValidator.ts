import type { stereotype, UmlRelationType } from "../features/diagram/types/diagram.types";

/**
 * Definition of allowed relationships based on UML 2.5 standards and Java semantics.
 * Key: The relationship type.
 * Value: A set of rules defining valid source and target stereotypes.
 */
const RELATIONSHIP_RULES: Record<
  UmlRelationType,
  {
    sources: stereotype[];
    targets: stereotype[];
    validator?: (source: stereotype, target: stereotype) => boolean;
  }
> = {
  inheritance: {
    // Class extends Class, Interface extends Interface
    sources: ["class", "abstract", "interface"],
    targets: ["class", "abstract", "interface"],
    validator: (source, target) => {
      const isSourceInterface = source === "interface";
      const isTargetInterface = target === "interface";
      return isSourceInterface === isTargetInterface;
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
    sources: ["class", "abstract", "interface", "enum"],
    targets: ["class", "abstract", "interface", "enum"],
  },
  aggregation: {
    sources: ["class", "abstract", "interface", "enum"],
    targets: ["class", "abstract", "interface", "enum"],
  },
  composition: {
    sources: ["class", "abstract", "interface", "enum"],
    targets: ["class", "abstract", "interface", "enum"],
  },
};

/**
 * Validates if a connection is semantically correct according to UML rules.
 * @param sourceStereotype The stereotype of the source node.
 * @param targetStereotype The stereotype of the target node.
 * @param relationType The type of relationship being attempted.
 * @returns {boolean} True if the connection is valid, false otherwise.
 */
export const validateConnection = (
  sourceStereotype: stereotype,
  targetStereotype: stereotype,
  relationType: UmlRelationType
): boolean => {
  if (sourceStereotype === "note" || targetStereotype === "note") return true;

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