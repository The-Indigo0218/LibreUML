export interface WikiArticle {
  id: string;
  category: string;
  subcategory?: string;
  imagePlaceholder: string;
  i18nKey: string;
  relatedIds?: string[];
}

export const wikiData: WikiArticle[] = [
  // ── UML CONCEPTS: Structures ─────────────────────────────────────────────
  {
    id: "concept_class",
    category: "uml_concepts",
    subcategory: "structures",
    imagePlaceholder: "placeholder-uml-class",
    i18nKey: "wiki.concepts.class",
    relatedIds: ["concept_interface", "concept_inheritance"],
  },
  {
    id: "concept_interface",
    category: "uml_concepts",
    subcategory: "structures",
    imagePlaceholder: "placeholder-uml-interface",
    i18nKey: "wiki.concepts.interface",
    relatedIds: ["concept_realization", "concept_class"],
  },
  {
    id: "concept_enumeration",
    category: "uml_concepts",
    subcategory: "structures",
    imagePlaceholder: "placeholder-uml-enum",
    i18nKey: "wiki.concepts.enumeration",
  },

  // ── UML CONCEPTS: Relations ───────────────────────────────────────────────
  {
    id: "concept_association",
    category: "uml_concepts",
    subcategory: "relations",
    imagePlaceholder: "placeholder-uml-association",
    i18nKey: "wiki.concepts.association",
    relatedIds: ["concept_aggregation", "concept_composition"],
  },
  {
    id: "concept_inheritance",
    category: "uml_concepts",
    subcategory: "relations",
    imagePlaceholder: "placeholder-uml-generalization",
    i18nKey: "wiki.concepts.inheritance",
    relatedIds: ["concept_class", "concept_realization"],
  },
  {
    id: "concept_composition",
    category: "uml_concepts",
    subcategory: "relations",
    imagePlaceholder: "placeholder-uml-composition",
    i18nKey: "wiki.concepts.composition",
    relatedIds: ["concept_aggregation", "concept_association"],
  },
  {
    id: "concept_aggregation",
    category: "uml_concepts",
    subcategory: "relations",
    imagePlaceholder: "placeholder-uml-aggregation",
    i18nKey: "wiki.concepts.aggregation",
    relatedIds: ["concept_composition", "concept_association"],
  },
  {
    id: "concept_dependency",
    category: "uml_concepts",
    subcategory: "relations",
    imagePlaceholder: "placeholder-uml-dependency",
    i18nKey: "wiki.concepts.dependency",
    relatedIds: ["concept_realization"],
  },
  {
    id: "concept_realization",
    category: "uml_concepts",
    subcategory: "relations",
    imagePlaceholder: "placeholder-uml-realization",
    i18nKey: "wiki.concepts.realization",
    relatedIds: ["concept_interface", "concept_inheritance"],
  },

  // ── UML CONCEPTS: Annotations ─────────────────────────────────────────────
  {
    id: "concept_note",
    category: "uml_concepts",
    subcategory: "annotations",
    imagePlaceholder: "placeholder-uml-note",
    i18nKey: "wiki.concepts.note",
  },

  // ── TOOL FEATURES: Export ─────────────────────────────────────────────────
  {
    id: "feat_export_luml",
    category: "tool_features",
    subcategory: "export",
    imagePlaceholder: "placeholder-export-luml",
    i18nKey: "wiki.features.export_luml",
    relatedIds: ["feat_projects_vs_standalone"],
  },
  {
    id: "feat_export_java",
    category: "tool_features",
    subcategory: "export",
    imagePlaceholder: "placeholder-export-java",
    i18nKey: "wiki.features.export_java",
  },
  {
    id: "feat_export_images",
    category: "tool_features",
    subcategory: "export",
    imagePlaceholder: "placeholder-export-images",
    i18nKey: "wiki.features.export_images",
  },
  {
    id: "feat_export_xmi",
    category: "tool_features",
    subcategory: "export",
    imagePlaceholder: "placeholder-export-xmi",
    i18nKey: "wiki.features.export_xmi",
  },

  // ── TOOL FEATURES: File Management ───────────────────────────────────────
  {
    id: "feat_projects_vs_standalone",
    category: "tool_features",
    subcategory: "file_management",
    imagePlaceholder: "placeholder-projects",
    i18nKey: "wiki.features.projects_vs_standalone",
    relatedIds: ["feat_autosave"],
  },
  {
    id: "feat_autosave",
    category: "tool_features",
    subcategory: "file_management",
    imagePlaceholder: "placeholder-autosave",
    i18nKey: "wiki.features.autosave",
    relatedIds: ["feat_projects_vs_standalone"],
  },
];
