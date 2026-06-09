import type { SemanticModel } from '../../core/domain/vfs/vfs.types';
import type { NodeSection, NodeViewModel } from '../../adapters/view-models/node.view-model';
import { getClassShapeSize } from '../shapes/ClassShape';

export type ElementKind = 'CLASS' | 'ABSTRACT_CLASS' | 'INTERFACE' | 'ENUM';

/** UML visibility symbol — mirrors classDiagramNodes.irVisSymbol. */
function visSymbol(v: string | undefined): string {
  switch (v) {
    case 'private':   return '-';
    case 'protected': return '#';
    case 'package':   return '~';
    default:          return '+';
  }
}

/**
 * Builds the rendered section text for a classifier exactly like the live
 * canvas does (see classDiagramNodes.buildSections), so measured sizes match
 * what the user will actually see.
 */
function buildSections(model: SemanticModel, element: any, kind: ElementKind): NodeSection[] {
  if (kind === 'ENUM') {
    return [{
      id: 'literals',
      items: (element.literals ?? []).map((lit: any, i: number) => ({
        id: `${element.id}-lit-${i}`,
        text: lit.name,
      })),
    }];
  }

  const attrs = (element.attributeIds ?? []).map((id: string) => model.attributes[id]).filter(Boolean);
  const ops = (element.operationIds ?? []).map((id: string) => model.operations[id]).filter(Boolean);

  return [
    {
      id: 'attributes',
      items: attrs.map((a: any) => ({
        id: a.id,
        text: `${visSymbol(a.visibility)}${a.name}: ${a.type}${a.multiplicity === '*' || a.multiplicity === '0..*' ? '[]' : ''}`,
      })),
    },
    {
      id: 'operations',
      items: ops.map((o: any) => {
        const paramsStr = (o.parameters ?? []).map((p: any) => `${p.name}: ${p.type}`).join(', ');
        const isConstructor = o.name === element.name;
        const text = isConstructor
          ? `${visSymbol(o.visibility)}${o.name}(${paramsStr})`
          : `${visSymbol(o.visibility)}${o.name}(${paramsStr}): ${o.returnType ?? 'void'}`;
        return { id: o.id, text };
      }),
    },
  ];
}

/**
 * Returns the real rendered {width, height} of a classifier node, accounting
 * for its name, stereotype and every attribute/operation/literal. Reuses the
 * exact ClassShape measurement so auto-layout matches the rendered canvas and
 * nodes never overlap.
 */
export function measureElementSize(
  model: SemanticModel,
  element: { id: string; name: string },
  kind: ElementKind,
): { width: number; height: number } {
  const stereotype =
    kind === 'ABSTRACT_CLASS' ? 'abstract'
    : kind === 'INTERFACE' ? 'interface'
    : kind === 'ENUM' ? 'enum'
    : undefined;

  const vm = {
    id: '',
    domainId: element.id,
    label: element.name,
    stereotype,
    sections: buildSections(model, element, kind),
    style: {
      containerClass: '',
      headerClass: '',
      badgeColor: '',
      labelFormat: kind === 'INTERFACE' ? 'font-normal' : kind === 'ABSTRACT_CLASS' ? 'italic font-bold' : 'font-bold',
      showStereotype: kind !== 'CLASS',
    },
  } as NodeViewModel;

  return getClassShapeSize(vm);
}
