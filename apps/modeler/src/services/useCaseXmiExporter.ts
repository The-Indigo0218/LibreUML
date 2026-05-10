/**
 * Use Case Diagram XMI 2.1 / UML 2.5.1 exporter.
 *
 * Serialization conventions:
 *  - Actors and UseCases as top-level packagedElement entries
 *  - SystemBoundaries as uml:Package
 *  - Generalizations nested inside the specific (sub) classifier
 *  - Include/Extend nested inside the owning UseCase per UML spec
 *  - Associations as top-level packagedElements
 */

import type { SemanticModel, IRActor, IRUseCase, IRSystemBoundary, IRRelation } from '../core/domain/vfs/vfs.types';
import type { DiagramView } from '../core/domain/vfs/vfs.types';
import { esc, xmiId, xmiHeader, xmiFooter, downloadXml } from './xmi/xmiHelpers';

// ─── Serializers ──────────────────────────────────────────────────────────────

function serializeActor(
  actor: IRActor,
  generalizations: IRRelation[],
): string {
  const attrs = [
    `xmi:type="uml:Actor"`,
    `xmi:id="${xmiId(actor.id)}"`,
    `name="${esc(actor.name)}"`,
    actor.isAbstract ? `isAbstract="true"` : '',
  ].filter(Boolean).join(' ');

  const nested: string[] = [];

  for (const rel of generalizations) {
    nested.push(
      `    <generalization xmi:id="${xmiId(rel.id)}" general="${xmiId(rel.targetId)}"/>`,
    );
  }

  if (nested.length === 0) return `  <packagedElement ${attrs}/>`;
  return `  <packagedElement ${attrs}>\n${nested.join('\n')}\n  </packagedElement>`;
}

function serializeUseCase(
  uc: IRUseCase,
  generalizations: IRRelation[],
  includes: IRRelation[],
  extends_: IRRelation[],
): string {
  const attrs = [
    `xmi:type="uml:UseCase"`,
    `xmi:id="${xmiId(uc.id)}"`,
    `name="${esc(uc.name)}"`,
    uc.isAbstract ? `isAbstract="true"` : '',
  ].filter(Boolean).join(' ');

  const nested: string[] = [];

  // Extension points
  (uc.extensionPoints ?? []).forEach((ep, i) => {
    nested.push(
      `    <extensionPoint xmi:id="${xmiId(uc.id)}_ep${i}" name="${esc(ep)}"/>`,
    );
  });

  // Generalizations (sub-UC → parent-UC)
  for (const rel of generalizations) {
    nested.push(
      `    <generalization xmi:id="${xmiId(rel.id)}" general="${xmiId(rel.targetId)}"/>`,
    );
  }

  // Include (source = including UC, target = included UC)
  for (const rel of includes) {
    nested.push(
      `    <include xmi:id="${xmiId(rel.id)}" xmi:type="uml:Include" includingCase="${xmiId(rel.sourceId)}" addition="${xmiId(rel.targetId)}"/>`,
    );
  }

  // Extend (source = extending UC, target = base UC)
  for (const rel of extends_) {
    const condId = `${xmiId(rel.id)}_cond`;
    const specId = `${xmiId(rel.id)}_spec`;
    const extAttrs = [
      `xmi:id="${xmiId(rel.id)}"`,
      `xmi:type="uml:Extend"`,
      `extendedCase="${xmiId(rel.targetId)}"`,
      `extension="${xmiId(rel.sourceId)}"`,
      rel.extensionPoint ? `extensionLocation="${xmiId(uc.id)}_ep${(uc.extensionPoints ?? []).indexOf(rel.extensionPoint)}"` : '',
    ].filter(Boolean).join(' ');

    if (rel.condition) {
      nested.push(
        `    <extend ${extAttrs}>`,
        `      <condition xmi:id="${condId}" xmi:type="uml:Constraint">`,
        `        <specification xmi:id="${specId}" xmi:type="uml:OpaqueExpression">`,
        `          <body>${esc(rel.condition)}</body>`,
        `        </specification>`,
        `      </condition>`,
        `    </extend>`,
      );
    } else {
      nested.push(`    <extend ${extAttrs}/>`);
    }
  }

  if (nested.length === 0) return `  <packagedElement ${attrs}/>`;
  return `  <packagedElement ${attrs}>\n${nested.join('\n')}\n  </packagedElement>`;
}

function serializeSystemBoundary(sb: IRSystemBoundary): string {
  return `  <packagedElement xmi:type="uml:Package" xmi:id="${xmiId(sb.id)}" name="${esc(sb.name)}"/>`;
}

function serializeAssociation(rel: IRRelation): string {
  const srcEnd = `${xmiId(rel.id)}_src`;
  const tgtEnd = `${xmiId(rel.id)}_tgt`;
  return [
    `  <packagedElement xmi:type="uml:Association" xmi:id="${xmiId(rel.id)}">`,
    `    <memberEnd xmi:idref="${srcEnd}"/>`,
    `    <memberEnd xmi:idref="${tgtEnd}"/>`,
    `    <ownedEnd xmi:id="${srcEnd}" xmi:type="uml:Property" type="${xmiId(rel.sourceId)}" association="${xmiId(rel.id)}"/>`,
    `    <ownedEnd xmi:id="${tgtEnd}" xmi:type="uml:Property" type="${xmiId(rel.targetId)}" association="${xmiId(rel.id)}"/>`,
    `  </packagedElement>`,
  ].join('\n');
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function buildUseCaseDiagramXmi(
  model: SemanticModel,
  diagramView: DiagramView | null,
  diagramName: string,
): string {
  const elementIds = diagramView
    ? new Set(diagramView.nodes.map((vn) => vn.elementId).filter(Boolean))
    : null;

  const inScope = (id: string) => !elementIds || elementIds.has(id);

  const actors = Object.values(model.actors ?? {}).filter((a) => inScope(a.id));
  const useCases = Object.values(model.useCases ?? {}).filter((uc) => inScope(uc.id));
  const boundaries = Object.values(model.systemBoundaries ?? {}).filter((sb) => inScope(sb.id));

  const UC_KINDS = new Set(['ASSOCIATION', 'INCLUDE', 'EXTEND', 'GENERALIZATION']);
  const allElements = new Set([
    ...actors.map((a) => a.id),
    ...useCases.map((uc) => uc.id),
    ...boundaries.map((sb) => sb.id),
  ]);
  const relations = Object.values(model.relations ?? {}).filter(
    (r) => UC_KINDS.has(r.kind) && allElements.has(r.sourceId) && allElements.has(r.targetId),
  );

  // Index relations by type and ownership
  const genBySpecific = new Map<string, IRRelation[]>();
  const includesByUC = new Map<string, IRRelation[]>();
  const extendsByUC = new Map<string, IRRelation[]>();
  const associations: IRRelation[] = [];

  for (const rel of relations) {
    if (rel.kind === 'GENERALIZATION') {
      const list = genBySpecific.get(rel.sourceId) ?? [];
      list.push(rel);
      genBySpecific.set(rel.sourceId, list);
    } else if (rel.kind === 'INCLUDE') {
      const list = includesByUC.get(rel.sourceId) ?? [];
      list.push(rel);
      includesByUC.set(rel.sourceId, list);
    } else if (rel.kind === 'EXTEND') {
      // Extend is owned by the extending UC (sourceId)
      const list = extendsByUC.get(rel.sourceId) ?? [];
      list.push(rel);
      extendsByUC.set(rel.sourceId, list);
    } else if (rel.kind === 'ASSOCIATION') {
      associations.push(rel);
    }
  }

  const lines: string[] = xmiHeader(model.id, diagramName);

  for (const actor of actors) {
    lines.push(serializeActor(actor, genBySpecific.get(actor.id) ?? []));
  }

  for (const uc of useCases) {
    lines.push(serializeUseCase(
      uc,
      genBySpecific.get(uc.id) ?? [],
      includesByUC.get(uc.id) ?? [],
      extendsByUC.get(uc.id) ?? [],
    ));
  }

  for (const sb of boundaries) {
    lines.push(serializeSystemBoundary(sb));
  }

  for (const assoc of associations) {
    lines.push(serializeAssociation(assoc));
  }

  lines.push(...xmiFooter());

  return lines.join('\n');
}

export function downloadUseCaseDiagramXmi(
  model: SemanticModel,
  diagramView: DiagramView | null,
  diagramName: string,
): void {
  downloadXml(buildUseCaseDiagramXmi(model, diagramView, diagramName), diagramName);
}
