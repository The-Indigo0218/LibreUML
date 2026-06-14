/**
 * mergeStandaloneModel — folds a standalone diagram's private SemanticModel back
 * into the shared project model ("Add to Project").
 *
 * Type-complete by construction: every element id in the local model is mapped to
 * a fresh UUID, then the *serialized* model is token-replaced. Because a UUID is a
 * unique quoted token, this rewrites EVERY cross-reference (attributeIds,
 * sourceLifelineId, coveredLifelineIds, operands[].messageIds, sourceId/targetId…)
 * without the function needing to know each IR type's schema — so it works for
 * class, use-case, sequence, domain and any future diagram type alike.
 *
 * Pure (no stores): returns the remapped element collections to merge into the
 * global model plus the remapped DiagramView. The caller owns the store writes.
 */
import type { SemanticModel, DiagramView } from '../core/domain/vfs/vfs.types';

/** Every id-keyed element collection on SemanticModel. */
export const MODEL_ELEMENT_COLLECTIONS = [
  'packages', 'classes', 'interfaces', 'enums', 'dataTypes', 'attributes', 'operations',
  'actors', 'useCases', 'systemBoundaries', 'ucModules', 'domainEntities', 'domainAttributes',
  'activityNodes', 'objectInstances', 'components', 'nodes', 'artifacts',
  'lifelines', 'messages', 'activations', 'interactionFragments', 'stateInvariants',
  'interactionUses', 'gates', 'generalOrderings', 'relations',
] as const;

type CollectionKey = (typeof MODEL_ELEMENT_COLLECTIONS)[number];

export interface MergeStandaloneResult {
  /** Remapped element collections to merge into the global model. */
  elements: Partial<SemanticModel>;
  /** Package name strings to fold in (not id-based). */
  packageNames: string[];
  /** DiagramView with node.elementId / edge.relationId pointed at the new ids. */
  view: DiagramView | null;
  /** old element id → new global id. */
  idMap: Map<string, string>;
  /** Number of model elements merged. */
  mergedCount: number;
}

export function mergeStandaloneModel(
  localModel: SemanticModel,
  view: DiagramView | null,
  newId: () => string = () => crypto.randomUUID(),
): MergeStandaloneResult {
  // 1. Map every element id (across all collections) to a fresh UUID.
  const idMap = new Map<string, string>();
  for (const key of MODEL_ELEMENT_COLLECTIONS) {
    const coll = localModel[key as CollectionKey] as Record<string, unknown> | undefined;
    if (!coll) continue;
    for (const id of Object.keys(coll)) {
      if (!idMap.has(id)) idMap.set(id, newId());
    }
  }

  // 2. Token-replace each old id (as a quoted JSON token) with its new id. Quoting
  //    avoids accidental substring hits inside names; UUIDs never overlap.
  let json = JSON.stringify(localModel);
  for (const [oldId, mappedId] of idMap) {
    json = json.split(`"${oldId}"`).join(`"${mappedId}"`);
  }
  const remapped = JSON.parse(json) as SemanticModel;

  // 3. Pull out the remapped element collections.
  const elements: Partial<SemanticModel> = {};
  for (const key of MODEL_ELEMENT_COLLECTIONS) {
    const coll = remapped[key as CollectionKey];
    if (coll && Object.keys(coll).length > 0) {
      (elements as Record<string, unknown>)[key] = coll;
    }
  }

  // 4. Remap the DiagramView references with the same map.
  const remappedView: DiagramView | null = view
    ? {
        ...view,
        nodes: view.nodes.map((vn) => ({
          ...vn,
          elementId: vn.elementId ? (idMap.get(vn.elementId) ?? vn.elementId) : vn.elementId,
        })),
        edges: view.edges.map((ve) => ({
          ...ve,
          relationId: idMap.get(ve.relationId) ?? ve.relationId,
        })),
      }
    : null;

  return {
    elements,
    packageNames: localModel.packageNames ?? [],
    view: remappedView,
    idMap,
    mergedCount: idMap.size,
  };
}
