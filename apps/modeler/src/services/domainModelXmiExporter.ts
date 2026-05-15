/**
 * Domain Model Diagram XMI 2.1 / UML 2.5.1 exporter.
 *
 * Serialization conventions:
 *  - IRDomainEntity → uml:Class with ownedAttribute entries (no type)
 *  - IRRelation { kind:'ASSOCIATION' } → uml:Association with memberEnd + ownedEnd
 *  - Only elements present in the DiagramView are exported
 */

import type { SemanticModel, IRRelation } from '../core/domain/vfs/vfs.types';
import type { DiagramView } from '../core/domain/vfs/vfs.types';
import { esc, xmiId, xmiHeader, xmiFooter, downloadXml } from './xmi/xmiHelpers';

function serializeDomainEntity(
  entityId: string,
  name: string,
  attributes: Array<{ id: string; name: string }>,
): string {
  const open = `  <packagedElement xmi:type="uml:Class" xmi:id="${xmiId(entityId)}" name="${esc(name)}"`;
  if (attributes.length === 0) return `${open}/>`;

  const attrLines = attributes.map(
    (a) =>
      `    <ownedAttribute xmi:id="${xmiId(a.id)}" name="${esc(a.name)}"/>`,
  );
  return `${open}>\n${attrLines.join('\n')}\n  </packagedElement>`;
}

function serializeAssociation(rel: IRRelation): string {
  const mulSrc = rel.sourceEnd?.multiplicity
    ? ` lower="${rel.sourceEnd.multiplicity.split('..')[0]}" upper="${rel.sourceEnd.multiplicity.split('..').pop()}"`
    : '';
  const mulTgt = rel.targetEnd?.multiplicity
    ? ` lower="${rel.targetEnd.multiplicity.split('..')[0]}" upper="${rel.targetEnd.multiplicity.split('..').pop()}"`
    : '';

  const srcEndId = `${xmiId(rel.id)}_src`;
  const tgtEndId = `${xmiId(rel.id)}_tgt`;

  return [
    `  <packagedElement xmi:type="uml:Association" xmi:id="${xmiId(rel.id)}"${rel.name ? ` name="${esc(rel.name)}"` : ''}>`,
    `    <memberEnd xmi:idref="${srcEndId}"/>`,
    `    <memberEnd xmi:idref="${tgtEndId}"/>`,
    `    <ownedEnd xmi:id="${srcEndId}" type="${xmiId(rel.sourceId)}"${mulSrc}/>`,
    `    <ownedEnd xmi:id="${tgtEndId}" type="${xmiId(rel.targetId)}"${mulTgt}/>`,
    `  </packagedElement>`,
  ].join('\n');
}

function buildDomainModelXmi(
  model: SemanticModel,
  diagramView: DiagramView | null,
  diagramName: string,
): string {
  const visibleEntityIds = new Set(
    (diagramView?.nodes ?? [])
      .map((vn) => vn.elementId)
      .filter(Boolean),
  );

  const entities = Object.values(model.domainEntities ?? {}).filter(
    (e) => visibleEntityIds.has(e.id),
  );

  const visibleRelationIds = new Set(
    (diagramView?.edges ?? []).map((ve) => ve.relationId),
  );

  const associations = Object.values(model.relations).filter(
    (r) =>
      r.kind === 'ASSOCIATION' &&
      visibleRelationIds.has(r.id) &&
      visibleEntityIds.has(r.sourceId) &&
      visibleEntityIds.has(r.targetId),
  );

  const lines: string[] = xmiHeader(model.id, diagramName);

  for (const entity of entities) {
    const attrs = entity.attributeIds
      .map((id) => model.domainAttributes?.[id])
      .filter((a): a is NonNullable<typeof a> => !!a)
      .map((a) => ({ id: a.id, name: a.name }));
    lines.push(serializeDomainEntity(entity.id, entity.name, attrs));
  }

  for (const assoc of associations) {
    lines.push(serializeAssociation(assoc));
  }

  lines.push(...xmiFooter());
  return lines.join('\n');
}

export function downloadDomainModelXmi(
  model: SemanticModel,
  diagramView: DiagramView | null,
  diagramName: string,
): void {
  downloadXml(buildDomainModelXmi(model, diagramView, diagramName), diagramName);
}
