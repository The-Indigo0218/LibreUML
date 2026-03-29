/**
 * vfsExport.service.ts
 *
 * Translates the VFS SemanticModel (IRClass / IRInterface / IREnum / IRRelation)
 * into the legacy DomainNode / DomainEdge format expected by XmiConverterService,
 * and provides diagram-scoped XMI + raw JSON download helpers.
 *
 * Scope rules:
 *  - XMI export: only classifiers whose ViewNode.elementId appears in the
 *    selected DiagramView are included (same behaviour as the legacy ExportMenu).
 *  - JSON export: raw DiagramView content downloaded as <name>.json.
 */

import type {
  SemanticModel,
  IRAttribute,
  IROperation,
  IREnum,
  IRClass,
  IRInterface,
  DiagramView,
  RelationKind,
} from '../core/domain/vfs/vfs.types';
import type { DomainNode } from '../core/domain/models/nodes';
import type { DomainEdge } from '../core/domain/models/edges';
import type { ClassAttribute, ClassMethod, MethodParameter } from '../core/domain/models/nodes/class-diagram.types';
import { XmiConverterService } from './xmiConverter.service';

// ─── Visibility ───────────────────────────────────────────────────────────────

type VisibilitySymbol = '+' | '-' | '#' | '~';

function visibilityToSymbol(v?: string): VisibilitySymbol {
  switch (v) {
    case 'private':   return '-';
    case 'protected': return '#';
    case 'package':   return '~';
    default:          return '+';
  }
}

// ─── RelationKind → ClassDiagramEdgeType ─────────────────────────────────────
//
// Only the subset that maps cleanly to a ClassDiagramEdge is included.
// Unsupported kinds (USAGE, TRANSITION, DEPLOYMENT, etc.) are silently dropped —
// they have no equivalent in the UML class-diagram edge vocabulary.

const RELATION_KIND_MAP: Partial<Record<RelationKind, string>> = {
  GENERALIZATION: 'INHERITANCE',
  REALIZATION:    'IMPLEMENTATION',
  ASSOCIATION:    'ASSOCIATION',
  AGGREGATION:    'AGGREGATION',
  COMPOSITION:    'COMPOSITION',
  DEPENDENCY:     'DEPENDENCY',
};

// ─── IRAttribute → ClassAttribute ─────────────────────────────────────────────

function irAttributeToClassAttribute(attr: IRAttribute): ClassAttribute {
  const multiplicity = attr.multiplicity ?? '';
  const isArray = multiplicity.includes('*') || multiplicity.includes('..');
  return {
    id: attr.id,
    name: attr.name,
    type: attr.type || 'String',
    visibility: visibilityToSymbol(attr.visibility),
    isArray,
    isStatic: attr.isStatic,
    defaultValue: attr.defaultValue,
  };
}

// ─── IROperation → ClassMethod ─────────────────────────────────────────────────

function irOperationToClassMethod(op: IROperation): ClassMethod {
  const params: MethodParameter[] = op.parameters
    .filter((p) => p.direction !== 'return')
    .map((p) => ({
      name: p.name,
      type: p.type || 'void',
      isArray: false,
    }));

  return {
    id: op.id,
    name: op.name,
    returnType: op.returnType || 'void',
    isReturnArray: false,
    visibility: visibilityToSymbol(op.visibility),
    isStatic: op.isStatic,
    isAbstract: op.isAbstract,
    parameters: params,
  };
}

// ─── SemanticModel → DomainNode[] ────────────────────────────────────────────

export function semanticModelToDomainNodes(
  model: SemanticModel,
  elementIds?: Set<string>,
): { nodes: DomainNode[]; classMap: Map<string, IRClass | IRInterface | IREnum> } {
  const nodes: DomainNode[] = [];
  const classMap = new Map<string, IRClass | IRInterface | IREnum>();
  const now = Date.now();

  const shouldInclude = (id: string) => !elementIds || elementIds.has(id);

  // Classes (regular + abstract)
  for (const cls of Object.values(model.classes) as IRClass[]) {
    if (!shouldInclude(cls.id)) continue;

    classMap.set(cls.id, cls);

    const attributes = cls.attributeIds
      .map((id) => model.attributes[id])
      .filter(Boolean)
      .map(irAttributeToClassAttribute);

    const methods = cls.operationIds
      .map((id) => model.operations[id])
      .filter(Boolean)
      .map(irOperationToClassMethod);

    nodes.push({
      id: cls.id,
      type: cls.isAbstract ? 'ABSTRACT_CLASS' : 'CLASS',
      name: cls.name,
      attributes,
      methods,
      // Generics will be handled via xmi:Extension in XmiConverterService
      package: cls.packageName ?? 'default',
      createdAt: now,
      updatedAt: now,
    } as DomainNode);
  }

  // Interfaces
  for (const iface of Object.values(model.interfaces) as IRInterface[]) {
    if (!shouldInclude(iface.id)) continue;

    classMap.set(iface.id, iface);

    const methods = iface.operationIds
      .map((id) => model.operations[id])
      .filter(Boolean)
      .map(irOperationToClassMethod);

    nodes.push({
      id: iface.id,
      type: 'INTERFACE',
      name: iface.name,
      methods,
      package: iface.packageName ?? 'default',
      createdAt: now,
      updatedAt: now,
    } as DomainNode);
  }

  // Enums
  for (const enm of Object.values(model.enums) as IREnum[]) {
    if (!shouldInclude(enm.id)) continue;

    classMap.set(enm.id, enm);

    const literals = enm.literals.map((lit, i) => ({
      id: `${enm.id}_lit_${i}`,
      name: lit.name,
      value: lit.value,
    }));

    nodes.push({
      id: enm.id,
      type: 'ENUM',
      name: enm.name,
      literals,
      package: enm.packageName ?? 'default',
      createdAt: now,
      updatedAt: now,
    } as DomainNode);
  }

  return { nodes, classMap };
}

// ─── SemanticModel → DomainEdge[] ────────────────────────────────────────────

export function semanticModelToDomainEdges(
  model: SemanticModel,
  elementIds?: Set<string>,
): DomainEdge[] {
  const now = Date.now();
  const edges: DomainEdge[] = [];

  for (const rel of Object.values(model.relations)) {
    const domainType = RELATION_KIND_MAP[rel.kind];
    if (!domainType) continue; // Unsupported kind — skip

    // If elementIds is provided, only include edges where BOTH endpoints are in the diagram.
    if (elementIds && (!elementIds.has(rel.sourceId) || !elementIds.has(rel.targetId))) continue;

    edges.push({
      id: rel.id,
      type: domainType,
      sourceNodeId: rel.sourceId,
      targetNodeId: rel.targetId,
      sourceMultiplicity: rel.sourceEnd?.multiplicity,
      targetMultiplicity: rel.targetEnd?.multiplicity,
      createdAt: now,
      updatedAt: now,
    } as DomainEdge);
  }

  return edges;
}

// ─── XMI download (diagram-scoped) ───────────────────────────────────────────

/**
 * Downloads an XMI 2.1 file containing only the classifiers visible in the
 * given DiagramView. If `diagramView` is null, all classifiers in the model
 * are exported.
 */
export function downloadVfsDiagramXmi(
  model: SemanticModel,
  diagramView: DiagramView | null,
  diagramName: string,
): void {
  const elementIds = diagramView
    ? new Set(diagramView.nodes.map((vn) => vn.elementId).filter(Boolean))
    : undefined;

  const { nodes, classMap } = semanticModelToDomainNodes(model, elementIds);
  const edges = semanticModelToDomainEdges(model, elementIds);

  // Note ViewNodes are view-only (elementId === '') — they have no IR element in the
  // SemanticModel. Build lightweight NoteNode objects so the XMI converter can emit
  // <ownedComment> elements for each note present in the diagram.
  if (diagramView) {
    const now = Date.now();
    for (const vn of diagramView.nodes) {
      if (!vn.elementId) {
        nodes.push({
          id: vn.id,
          type: 'NOTE',
          content: vn.content ?? '',
          createdAt: now,
          updatedAt: now,
        } as DomainNode);
      }
    }
  }

  XmiConverterService.downloadXmi(model.id, diagramName, nodes, edges, classMap);
}

// ─── JSON download (DiagramView) ─────────────────────────────────────────────

/**
 * Downloads the raw DiagramView content of a VFS file as a `.json` file.
 */
export function downloadVfsDiagramJson(
  content: DiagramView | null,
  fileName: string,
): void {
  const safeName = fileName.replace(/\.luml$/i, '');
  const json = JSON.stringify(content ?? {}, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.luml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
