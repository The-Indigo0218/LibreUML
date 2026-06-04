import { standaloneModelOps } from '../../../../store/standaloneModelOps';
import { useModelStore } from '../../../../store/model.store';
import type {
  IRClass,
  IRInterface,
  IREnum,
  IRPackage,
  Visibility,
  ViewNode,
} from '../../../../core/domain/vfs/vfs.types';
import type {
  NodeViewModel,
  PackageViewModel,
  NodeStyleConfig,
  NodeSection,
} from '../../../../adapters/view-models/node.view-model';
import {
  resolveSemanticElement,
  getAbsolutePosition,
  makeNoteNode,
  type SemanticKind,
  type NodeBuilderContext,
} from './sharedNodeBuilders';

// ─── Style registry ───────────────────────────────────────────────────────────

interface ElementDisplayConfig {
  style: NodeStyleConfig;
  stereotype?: string;
}

const VFS_DISPLAY: Record<string, ElementDisplayConfig> = {
  CLASS: {
    style: {
      containerClass: 'bg-uml-class-bg border-uml-class-border',
      headerClass: 'bg-surface-hover border-uml-class-border',
      badgeColor: 'text-uml-class-border',
      labelFormat: 'font-bold',
      showStereotype: false,
    },
  },
  ABSTRACT_CLASS: {
    stereotype: 'abstract',
    style: {
      containerClass: 'bg-uml-abstract-bg border-uml-abstract-border',
      headerClass: 'bg-surface-hover border-uml-abstract-border',
      badgeColor: 'text-uml-abstract-border',
      labelFormat: 'italic font-bold',
      showStereotype: true,
    },
  },
  INTERFACE: {
    stereotype: 'interface',
    style: {
      containerClass: 'bg-uml-interface-bg border-uml-interface-border',
      headerClass: 'bg-surface-secondary border-uml-interface-border',
      badgeColor: 'text-uml-interface-border',
      labelFormat: 'font-normal',
      showStereotype: true,
    },
  },
  ENUM: {
    stereotype: 'enum',
    style: {
      containerClass: 'bg-purple-100 dark:bg-purple-900/20 border-purple-400 dark:border-purple-500',
      headerClass: 'bg-purple-200 dark:bg-purple-900/50 border-purple-400 dark:border-purple-500',
      badgeColor: 'text-purple-700 dark:text-purple-300',
      labelFormat: 'font-bold',
      showStereotype: true,
    },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function irVisSymbol(v: Visibility | undefined): string {
  switch (v) {
    case 'private':   return '-';
    case 'protected': return '#';
    case 'package':   return '~';
    default:          return '+';
  }
}

function buildSections(
  model: { attributes: Record<string, { id: string; name: string; type: string; multiplicity?: string; isStatic?: boolean; visibility?: Visibility }>; operations: Record<string, { id: string; name: string; parameters: { name: string; type: string }[]; returnType?: string; isStatic?: boolean; isAbstract?: boolean; visibility?: Visibility }> },
  element: IRClass | IRInterface | IREnum,
  kind: SemanticKind,
): NodeSection[] {
  const sections: NodeSection[] = [];

  if (kind === 'CLASS' || kind === 'ABSTRACT_CLASS') {
    const cls = element as IRClass;
    const attrs = cls.attributeIds.map((id) => model.attributes[id]).filter(Boolean);
    const ops = cls.operationIds.map((id) => model.operations[id]).filter(Boolean);

    sections.push({
      id: 'attributes',
      items: attrs.map((a) => ({
        id: a.id,
        text: `${irVisSymbol(a.visibility)}${a.name}: ${a.type}${a.multiplicity === '*' || a.multiplicity === '0..*' ? '[]' : ''}`,
        isStatic: a.isStatic,
      })),
    });
    sections.push({
      id: 'operations',
      items: ops.map((o) => {
        const paramsStr = o.parameters.map((p) => `${p.name}: ${p.type}`).join(', ');
        const isConstructor = o.name === element.name;
        const text = isConstructor
          ? `${irVisSymbol(o.visibility)}${o.name}(${paramsStr})`
          : `${irVisSymbol(o.visibility)}${o.name}(${paramsStr}): ${o.returnType ?? 'void'}`;
        return { id: o.id, text, isStatic: o.isStatic, isAbstract: o.isAbstract };
      }),
    });
  } else if (kind === 'INTERFACE') {
    const iface = element as IRInterface;
    const attrs = (iface.attributeIds ?? []).map((id) => model.attributes[id]).filter(Boolean);
    const ops = iface.operationIds.map((id) => model.operations[id]).filter(Boolean);

    sections.push({
      id: 'attributes',
      items: attrs.map((a) => ({
        id: a.id,
        text: `${irVisSymbol(a.visibility)}${a.name}: ${a.type}`,
        isStatic: a.isStatic,
      })),
    });
    sections.push({
      id: 'operations',
      items: ops.map((o) => {
        const paramsStr = o.parameters.map((p) => `${p.name}: ${p.type}`).join(', ');
        const isConstructor = o.name === element.name;
        const text = isConstructor
          ? `${irVisSymbol(o.visibility)}${o.name}(${paramsStr})`
          : `${irVisSymbol(o.visibility)}${o.name}(${paramsStr}): ${o.returnType ?? 'void'}`;
        return { id: o.id, text, isAbstract: o.isAbstract };
      }),
    });
  } else if (kind === 'ENUM') {
    const enm = element as IREnum;
    sections.push({
      id: 'literals',
      items: enm.literals.map((lit, i) => ({
        id: `${enm.id}-lit-${i}`,
        text: lit.name,
      })),
    });
  }

  return sections;
}

function computePackageDisplayName(viewNode: ViewNode, pkg: IRPackage): string {
  if (!viewNode.parentPackageId) return pkg.name;
  return pkg.name.split('.').pop() || pkg.name;
}

function makeClassNode(
  viewNode: ViewNode,
  label: string,
  displayConfig: ElementDisplayConfig,
  sections: NodeSection[],
  onRename: (name: string, generics?: string) => void,
  allViewNodes: ViewNode[],
  badge?: string,
) {
  const viewModel: NodeViewModel = {
    id: viewNode.id,
    domainId: viewNode.elementId,
    label,
    stereotype: displayConfig.stereotype,
    badge: badge || undefined,
    sections,
    style: displayConfig.style,
    colorOverride: viewNode.color,
    metadata: { onRename },
  };
  return {
    id: viewNode.id,
    type: 'umlClass',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: viewModel,
    domainId: viewNode.elementId,
  };
}

function makePackageNode(
  viewNode: ViewNode,
  pkg: IRPackage,
  allViewNodes: ViewNode[],
  _allPackages: Record<string, IRPackage>,
) {
  const childCount = allViewNodes.filter((vn) => vn.parentPackageId === viewNode.id).length;
  const depth = (() => {
    let d = 0;
    let currentId = viewNode.parentPackageId;
    while (currentId && d < 10) {
      const parent = allViewNodes.find((vn) => vn.id === currentId);
      if (!parent) break;
      d++;
      currentId = parent.parentPackageId;
    }
    return d;
  })();

  const viewModel: PackageViewModel = {
    __brand: 'package',
    id: viewNode.id,
    name: computePackageDisplayName(viewNode, pkg),
    collapsed: viewNode.collapsed ?? false,
    color: viewNode.color,
    childCount,
    depth,
  };
  return {
    id: viewNode.id,
    type: 'umlPackage',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: viewModel,
    domainId: viewNode.elementId,
  };
}

// ─── Public builder ───────────────────────────────────────────────────────────

export function buildClassDiagramNodes(ctx: NodeBuilderContext) {
  const { diagramView, model, isStandalone, activeTabId, handleNoteUpdate } = ctx;

  return diagramView.nodes.map((viewNode: ViewNode) => {
    const { element, kind } = resolveSemanticElement(model, viewNode.elementId);

    if (kind === 'NOTE') {
      return makeNoteNode(viewNode, handleNoteUpdate, diagramView.nodes);
    }

    if (kind === 'PACKAGE') {
      return makePackageNode(viewNode, element as IRPackage, diagramView.nodes, model.packages);
    }

    const label = element?.name ?? 'NewClass';
    const displayConfig = VFS_DISPLAY[kind] ?? VFS_DISPLAY.CLASS;
    const sections = element
      ? buildSections(model, element as IRClass | IRInterface | IREnum, kind)
      : [];
    const badge = viewNode.parentPackageId
      ? undefined
      : (element as IRClass | IRInterface | IREnum | null)?.packageName ?? undefined;

    const onRename = (name: string, generics?: string) => {
      if (isStandalone && activeTabId) {
        const ops = standaloneModelOps(activeTabId);
        switch (kind) {
          case 'CLASS':
          case 'ABSTRACT_CLASS':
            ops.updateClass(viewNode.elementId, {
              name,
              ...(generics !== undefined ? { stereotypes: [generics] } : {}),
            });
            break;
          case 'INTERFACE':
            ops.updateInterface(viewNode.elementId, { name });
            break;
          case 'ENUM':
            ops.updateEnum(viewNode.elementId, { name });
            break;
        }
      } else {
        const ms = useModelStore.getState();
        if (!ms.model) return;
        switch (kind) {
          case 'CLASS':
          case 'ABSTRACT_CLASS':
            ms.updateClass(viewNode.elementId, {
              name,
              ...(generics !== undefined ? { stereotypes: [generics] } : {}),
            });
            break;
          case 'INTERFACE':
            ms.updateInterface(viewNode.elementId, { name });
            break;
          case 'ENUM':
            ms.updateEnum(viewNode.elementId, { name });
            break;
        }
      }
    };

    return makeClassNode(viewNode, label, displayConfig, sections, onRename, diagramView.nodes, badge);
  });
}
