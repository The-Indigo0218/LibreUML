/**
 * legacyLumlMapper.service.ts
 *
 * Backward-compatibility layer for V1 .luml files.
 *
 * The original LibreUML MVP saved diagrams as plain JSON (not a ZIP).
 * The V1 schema is a flat ReactFlow snapshot:
 *
 *   {
 *     id: string,
 *     name: string,
 *     nodes: UmlClassNode[],   // { id, type, position, data }
 *     edges: UmlEdge[],        // { id, source, target, data? }
 *     viewport: { x, y, zoom }
 *   }
 *
 * This service detects that shape and converts it into a V2 LumlParseResult
 * of type 'diagram', which is then consumed by injectDiagramIntoVFS() exactly
 * like a modern single-diagram export.
 */

import type {
  SemanticModel,
  DiagramView,
  ViewNode,
  ViewEdge,
  IRClass,
  IRInterface,
  IREnum,
  IRAttribute,
  IROperation,
  IRRelation,
  RelationKind,
} from '../core/domain/vfs/vfs.types';
import type { LumlParseResult } from './projectIO.service';

// ─── Legacy V1 types ──────────────────────────────────────────────────────────

type LegacyVisibility = '+' | '-' | '#' | '~';
type LegacyStereotype = 'class' | 'interface' | 'abstract' | 'note' | 'enum';

interface LegacyAttribute {
  id: string;
  name: string;
  type: string;
  visibility: LegacyVisibility;
  isArray: boolean;
}

interface LegacyMethod {
  id: string;
  name: string;
  returnType: string;
  visibility: LegacyVisibility;
  isStatic?: boolean;
  isConstructor?: boolean;
  parameters: { name: string; type: string; isArray?: boolean }[];
}

interface LegacyNodeData {
  label: string;
  content?: string;
  attributes: LegacyAttribute[];
  methods: LegacyMethod[];
  stereotype: LegacyStereotype;
}

interface LegacyNode {
  id: string;
  type: 'umlClass' | 'umlNote';
  position: { x: number; y: number };
  data: LegacyNodeData;
  width?: number;
  height?: number;
}

interface LegacyEdgeData {
  type?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
}

interface LegacyEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: LegacyEdgeData;
}

export interface LegacyDiagramState {
  id: string;
  name: string;
  nodes: LegacyNode[];
  edges: LegacyEdge[];
  viewport: { x: number; y: number; zoom: number };
}

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Returns true when the parsed value looks like a V1 DiagramState.
 * We require: string id, string name, array nodes, array edges, object viewport.
 */
export function isLegacyDiagramState(raw: unknown): raw is LegacyDiagramState {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    Array.isArray(r.nodes) &&
    Array.isArray(r.edges) &&
    typeof r.viewport === 'object' &&
    r.viewport !== null
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function mapVisibility(v: LegacyVisibility): 'public' | 'private' | 'protected' | 'package' {
  switch (v) {
    case '+': return 'public';
    case '-': return 'private';
    case '#': return 'protected';
    case '~': return 'package';
    default:  return 'public';
  }
}

function mapEdgeTypeToRelationKind(type?: string): RelationKind {
  switch (type?.toLowerCase()) {
    case 'inheritance':    return 'GENERALIZATION';
    case 'implementation': return 'REALIZATION';
    case 'dependency':     return 'DEPENDENCY';
    case 'aggregation':    return 'AGGREGATION';
    case 'composition':    return 'COMPOSITION';
    default:               return 'ASSOCIATION';
  }
}

function emptyPartialModel(name: string): SemanticModel {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    version: '1.0.0',
    packages: {},
    classes: {},
    interfaces: {},
    enums: {},
    dataTypes: {},
    attributes: {},
    operations: {},
    actors: {},
    useCases: {},
    activityNodes: {},
    objectInstances: {},
    components: {},
    nodes: {},
    artifacts: {},
    relations: {},
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Converts a V1 DiagramState (plain JSON) into a modern LumlParseResult of
 * type 'diagram'.  The result is ready for injectDiagramIntoVFS(), which
 * will remap all IDs to fresh UUIDs and merge it into the workspace.
 */
export function mapLegacyDiagram(
  legacy: LegacyDiagramState,
): LumlParseResult & { exportType: 'diagram' } {
  const partialModel = emptyPartialModel(legacy.name);
  const viewNodes: ViewNode[] = [];
  const viewEdges: ViewEdge[] = [];

  // Maps old V1 node.id → new elementId (undefined for note nodes)
  const idMap = new Map<string, string | undefined>();

  // ── Nodes ─────────────────────────────────────────────────────────────────
  for (const node of legacy.nodes) {
    if (node.type === 'umlNote') {
      viewNodes.push({
        id: crypto.randomUUID(),
        elementId: '',           // sentinel: no IR backing element
        x: node.position.x,
        y: node.position.y,
        width: node.width,
        height: node.height,
        content: node.data.content ?? '',
        noteTitle: node.data.label,
      });
      idMap.set(node.id, undefined); // notes don't participate in edges
      continue;
    }

    const elementId = crypto.randomUUID();
    const { label, attributes = [], methods = [], stereotype } = node.data;

    if (stereotype === 'interface') {
      const opIds: string[] = [];
      for (const m of methods) {
        const opId = crypto.randomUUID();
        const op: IROperation = {
          id: opId,
          kind: 'OPERATION',
          name: m.name,
          returnType: m.returnType || 'void',
          visibility: mapVisibility(m.visibility),
          parameters: m.parameters.map((p) => ({ name: p.name, type: p.type, isArray: p.isArray ?? false })),
          isReturnArray: false,
          isStatic: m.isStatic ?? false,
        };
        partialModel.operations[opId] = op;
        opIds.push(opId);
      }
      const iface: IRInterface = {
        id: elementId,
        kind: 'INTERFACE',
        name: label,
        operationIds: opIds,
        visibility: 'public',
        isExternal: true,
      };
      partialModel.interfaces[elementId] = iface;

    } else if (stereotype === 'enum') {
      const irEnum: IREnum = {
        id: elementId,
        kind: 'ENUM',
        name: label,
        literals: attributes.map((a) => ({ name: a.name })),
        visibility: 'public',
        isExternal: true,
      };
      partialModel.enums[elementId] = irEnum;

    } else {
      // 'class' or 'abstract'
      const attrIds: string[] = [];
      for (const a of attributes) {
        const attrId = crypto.randomUUID();
        const attr: IRAttribute = {
          id: attrId,
          kind: 'ATTRIBUTE',
          name: a.name,
          type: a.type,
          visibility: mapVisibility(a.visibility),
          multiplicity: a.isArray ? '0..*' : undefined,
        };
        partialModel.attributes[attrId] = attr;
        attrIds.push(attrId);
      }
      const opIds: string[] = [];
      for (const m of methods) {
        const opId = crypto.randomUUID();
        const op: IROperation = {
          id: opId,
          kind: 'OPERATION',
          name: m.name,
          returnType: m.returnType || 'void',
          visibility: mapVisibility(m.visibility),
          parameters: m.parameters.map((p) => ({ name: p.name, type: p.type, isArray: p.isArray ?? false })),
          isReturnArray: false,
          isStatic: m.isStatic ?? false,
        };
        partialModel.operations[opId] = op;
        opIds.push(opId);
      }
      const cls: IRClass = {
        id: elementId,
        kind: 'CLASS',
        name: label,
        attributeIds: attrIds,
        operationIds: opIds,
        visibility: 'public',
        isAbstract: stereotype === 'abstract',
        isExternal: true,
      };
      partialModel.classes[elementId] = cls;
    }

    idMap.set(node.id, elementId);
    viewNodes.push({
      id: crypto.randomUUID(),
      elementId,
      x: node.position.x,
      y: node.position.y,
      width: node.width,
      height: node.height,
    });
  }

  // ── Edges ─────────────────────────────────────────────────────────────────
  for (const edge of legacy.edges) {
    const sourceElementId = idMap.get(edge.source);
    const targetElementId = idMap.get(edge.target);
    // Skip edges involving unmapped nodes or note nodes
    if (!sourceElementId || !targetElementId) continue;

    const kind = mapEdgeTypeToRelationKind(edge.data?.type ?? edge.type);
    const relationId = crypto.randomUUID();

    const relation: IRRelation = {
      id: relationId,
      kind,
      sourceId: sourceElementId,
      targetId: targetElementId,
      isExternal: true,
      ...(edge.data?.sourceMultiplicity || edge.data?.targetMultiplicity
        ? {
            sourceEnd: {
              elementId: sourceElementId,
              multiplicity: edge.data?.sourceMultiplicity,
            },
            targetEnd: {
              elementId: targetElementId,
              multiplicity: edge.data?.targetMultiplicity,
            },
          }
        : {}),
    };
    partialModel.relations[relationId] = relation;

    viewEdges.push({
      id: crypto.randomUUID(),
      relationId,
      waypoints: [],
      sourceMultiplicity: edge.data?.sourceMultiplicity,
      targetMultiplicity: edge.data?.targetMultiplicity,
    });
  }

  const view: DiagramView = {
    diagramId: legacy.id,
    nodes: viewNodes,
    edges: viewEdges,
  };

  return { exportType: 'diagram', view, partialModel, name: legacy.name };
}
