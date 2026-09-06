/**
 * IR → DomainNode/DomainEdge adapter (A5, §16).
 *
 * `getDiagramRegistry(type).validator` (BaseValidator) speaks `DomainNode` /
 * `DomainEdge` — a vestigial SSOT layer from before the VFS SemanticModel
 * (ADR-0001). Its `validateNode`/`validateEdge` were never wired to anything
 * a user looks at (§16.1): only `useConnectionDraw`'s *different*,
 * stereotype-string `validateConnection` runs live, at connection-drop time.
 *
 * This module is the missing bridge, built once, generic across diagram
 * types: `resolvedElementToDomainNode` turns whatever `resolveSemanticElement`
 * hands back into the DomainNode variant its own validator expects, and
 * `relationToDomainEdge` does the same for `IRRelation` → `DomainEdge`,
 * per diagram type (the two disagree on strings for the same UML concept —
 * see `EDGE_KIND_BY_DIAGRAM` below).
 *
 * `createdAt`/`updatedAt` on `BaseDomainNode`/`BaseDomainEdge` have no IR
 * equivalent (the IR never tracked them) — `0` is a harmless placeholder;
 * nothing here is persisted, only handed to a validator and discarded.
 */
import type {
  SemanticModel,
  ResolvedElement,
  IRRelation,
  IRClass,
  IRInterface,
  IREnum,
  IRActor,
  IRUseCase,
  IRUCModule,
  IRDomainEntity,
  IRLifeline,
  IRActivityNode,
  IRActivityPartition,
  DiagramType,
} from '../../../core/domain/vfs/vfs.types';
import type { DomainNode } from '../../../core/domain/models/nodes';
import type { DomainEdge } from '../../../core/domain/models/edges';
import { IR_TO_ACTIVITY_NODE_TYPE } from '../../../core/domain/models/nodes/activity-diagram.types';
import {
  irAttributeToClassAttribute,
  irOperationToClassMethod,
} from '../../../services/vfsExport.service';

const NOW = 0;

/**
 * Resolves an id to its DomainNode across every diagram type — the reverse
 * side of `resolveSemanticElement`. Returns `null` for PACKAGE/NOTE/UNKNOWN,
 * which no validator's `validateNode` treats as a real element to check.
 */
export function resolvedElementToDomainNode(
  resolved: ResolvedElement,
  model: SemanticModel,
): DomainNode | null {
  const { element, kind } = resolved;
  if (!element) return null;

  switch (kind) {
    case 'CLASS':
    case 'ABSTRACT_CLASS': {
      const cls = element as IRClass;
      return {
        id: cls.id,
        type: kind,
        name: cls.name,
        attributes: cls.attributeIds.map((id) => model.attributes[id]).filter(Boolean).map(irAttributeToClassAttribute),
        methods: cls.operationIds.map((id) => model.operations[id]).filter(Boolean).map(irOperationToClassMethod),
        generics: cls.generics,
        package: cls.packageName,
        documentation: cls.documentation,
        createdAt: NOW,
        updatedAt: NOW,
      } as DomainNode;
    }
    case 'INTERFACE': {
      const iface = element as IRInterface;
      return {
        id: iface.id,
        type: 'INTERFACE',
        name: iface.name,
        methods: iface.operationIds.map((id) => model.operations[id]).filter(Boolean).map(irOperationToClassMethod),
        generics: iface.generics,
        package: iface.packageName,
        documentation: iface.documentation,
        createdAt: NOW,
        updatedAt: NOW,
      } as DomainNode;
    }
    case 'ENUM': {
      const enm = element as IREnum;
      return {
        id: enm.id,
        type: 'ENUM',
        name: enm.name,
        literals: enm.literals.map((lit, i) => ({ id: `${enm.id}_lit_${i}`, name: lit.name, value: lit.value })),
        package: enm.packageName,
        documentation: enm.documentation,
        createdAt: NOW,
        updatedAt: NOW,
      } as DomainNode;
    }
    case 'ACTOR': {
      const actor = element as IRActor;
      return {
        id: actor.id,
        type: 'ACTOR',
        name: actor.name,
        documentation: actor.documentation ?? actor.briefDescription,
        createdAt: NOW,
        updatedAt: NOW,
      } as DomainNode;
    }
    case 'USECASE': {
      const uc = element as IRUseCase;
      return {
        id: uc.id,
        type: 'USE_CASE',
        name: uc.name,
        description: uc.briefDescription,
        extensionPoints: uc.extensionPoints,
        documentation: uc.documentation,
        createdAt: NOW,
        updatedAt: NOW,
      } as DomainNode;
    }
    // SYSTEM_BOUNDARY: skipped deliberately. `containedUseCaseIds` (what its
    // validator checks) is a ViewNode-level containment (parentPackageId),
    // never persisted on `IRSystemBoundary` — this function only sees the IR,
    // so it has no honest value to report here (not "always empty", which
    // would just mean spurious warnings on every boundary). Revisit if this
    // adapter ever gains ViewNode context.
    case 'UC_MODULE': {
      const m = element as IRUCModule;
      return { id: m.id, type: 'UC_MODULE', name: m.name, createdAt: NOW, updatedAt: NOW } as DomainNode;
    }
    case 'DOMAIN_ENTITY': {
      const de = element as IRDomainEntity;
      return {
        id: de.id,
        type: 'DOMAIN_ENTITY',
        name: de.name,
        attributes: de.attributeIds
          .map((id) => model.domainAttributes?.[id])
          .filter((a): a is NonNullable<typeof a> => !!a)
          .map((a) => ({ id: a.id, name: a.name })),
        documentation: de.documentation,
        createdAt: NOW,
        updatedAt: NOW,
      } as DomainNode;
    }
    case 'LIFELINE': {
      const ll = element as IRLifeline;
      return {
        id: ll.id,
        type: 'LIFELINE',
        name: ll.name,
        participantKind: ll.participantKind,
        represents: ll.represents,
        alias: ll.alias,
        documentation: ll.documentation,
        createdAt: NOW,
        updatedAt: NOW,
      } as DomainNode;
    }
    case 'ACTIVITY_NODE': {
      const n = element as IRActivityNode;
      return {
        id: n.id,
        type: IR_TO_ACTIVITY_NODE_TYPE[n.activityType],
        name: n.name,
        activityId: n.activityId,
        partitionId: n.partitionId,
        callsOperationId: n.callsOperationId,
        classifierId: n.classifierId,
        barOrientation: n.barOrientation,
        ownerActionId: n.ownerActionId,
        documentation: n.documentation,
        createdAt: NOW,
        updatedAt: NOW,
      } as DomainNode;
    }
    case 'ACTIVITY_PARTITION': {
      const p = element as IRActivityPartition;
      return {
        id: p.id,
        type: 'ACTIVITY_PARTITION',
        name: p.name,
        activityId: p.activityId,
        index: p.index,
        representsId: p.representsId,
        documentation: p.documentation,
        createdAt: NOW,
        updatedAt: NOW,
      } as DomainNode;
    }
    // PACKAGE / NOTE / UNKNOWN: no validator treats these as a checkable node.
    default:
      return null;
  }
}

/**
 * `IRRelation.kind` → the edge-type string the given diagram's validator
 * expects. Class Diagram alone renames GENERALIZATION/REALIZATION to
 * INHERITANCE/IMPLEMENTATION (a `vfsExport.service.ts` convention this
 * mirrors); every other diagram type uses the RelationKind spelling as-is.
 */
const CLASS_EDGE_KIND: Partial<Record<IRRelation['kind'], string>> = {
  GENERALIZATION: 'INHERITANCE',
  REALIZATION: 'IMPLEMENTATION',
  ASSOCIATION: 'ASSOCIATION',
  AGGREGATION: 'AGGREGATION',
  COMPOSITION: 'COMPOSITION',
  DEPENDENCY: 'DEPENDENCY',
};

const PASSTHROUGH_EDGE_KINDS: Partial<Record<DiagramType, Set<string>>> = {
  USE_CASE_DIAGRAM: new Set(['ASSOCIATION', 'INCLUDE', 'EXTEND', 'GENERALIZATION']),
  DOMAIN_MODEL_DIAGRAM: new Set(['ASSOCIATION', 'GENERALIZATION', 'AGGREGATION', 'COMPOSITION']),
  ACTIVITY_DIAGRAM: new Set(['CONTROL_FLOW', 'OBJECT_FLOW']),
};

/**
 * Converts an `IRRelation` into the `DomainEdge` its owning diagram type's
 * validator expects, or `null` when that diagram type has no opinion on this
 * relation kind (e.g. a sequence message, which isn't an `IRRelation` at all
 * and never reaches this function — see `useProjectProblems`'s scope note).
 */
export function relationToDomainEdge(rel: IRRelation, diagramType: DiagramType): DomainEdge | null {
  let type: string | undefined;
  if (diagramType === 'CLASS_DIAGRAM') {
    type = CLASS_EDGE_KIND[rel.kind];
  } else {
    const allowed = PASSTHROUGH_EDGE_KINDS[diagramType];
    type = allowed?.has(rel.kind) ? rel.kind : undefined;
  }
  if (!type) return null;

  return {
    id: rel.id,
    type,
    sourceNodeId: rel.sourceId,
    targetNodeId: rel.targetId,
    sourceMultiplicity: rel.sourceEnd?.multiplicity,
    targetMultiplicity: rel.targetEnd?.multiplicity,
    label: rel.name,
    condition: rel.condition,
    extensionPoint: rel.extensionPoint,
    guard: rel.guard,
    weight: rel.weight,
    createdAt: NOW,
    updatedAt: NOW,
  } as DomainEdge;
}
