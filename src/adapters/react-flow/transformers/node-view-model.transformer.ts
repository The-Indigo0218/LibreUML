import type { DomainNode } from '../../../core/domain/models/nodes';
import type { 
  ClassNode, 
  InterfaceNode, 
  AbstractClassNode, 
  EnumNode,
  NoteNode,
  ClassAttribute,
  ClassMethod,
} from '../../../core/domain/models/nodes/class-diagram.types';
import type { 
  NodeViewModel, 
  NoteViewModel, 
  NodeSection, 
  NodeStyleConfig,
  AnyNodeViewModel,
} from '../view-models/node.view-model';

/**
 * Style configurations for different node types
 */
const STYLE_CONFIGS: Record<string, NodeStyleConfig> = {
  CLASS: {
    containerClass: "bg-uml-class-bg border-uml-class-border",
    headerClass: "bg-surface-hover border-uml-class-border",
    badgeColor: "text-uml-class-border",
    labelFormat: "font-bold",
    showStereotype: false,
  },
  INTERFACE: {
    containerClass: "bg-uml-interface-bg border-uml-interface-border",
    headerClass: "bg-surface-secondary border-uml-interface-border",
    badgeColor: "text-uml-interface-border",
    labelFormat: "font-normal",
    showStereotype: true,
  },
  ABSTRACT_CLASS: {
    containerClass: "bg-uml-abstract-bg border-uml-abstract-border",
    headerClass: "bg-surface-hover border-uml-abstract-border",
    badgeColor: "text-uml-abstract-border",
    labelFormat: "italic font-bold",
    showStereotype: true,
  },
  ENUM: {
    containerClass: "bg-purple-100 dark:bg-purple-900/20 border-purple-400 dark:border-purple-500",
    headerClass: "bg-purple-200 dark:bg-purple-900/50 border-purple-400 dark:border-purple-500",
    badgeColor: "text-purple-700 dark:text-purple-300",
    labelFormat: "font-bold",
    showStereotype: true,
  },
};

/**
 * Stereotype display names
 */
const STEREOTYPE_LABELS: Record<string, string> = {
  INTERFACE: 'interface',
  ABSTRACT_CLASS: 'abstract',
  ENUM: 'enum',
};

/**
 * Visibility symbol mapping
 */
const VISIBILITY_SYMBOLS: Record<string, string> = {
  PUBLIC: '+',
  PRIVATE: '-',
  PROTECTED: '#',
  PACKAGE: '~',
};

/**
 * Formats an attribute into a display string
 * Example: "+ name: String"
 */
function formatAttribute(attr: ClassAttribute): string {
  const visibility = VISIBILITY_SYMBOLS[attr.visibility] || '+';
  const arrayNotation = attr.isArray ? '[]' : '';
  const staticPrefix = attr.isStatic ? 'static ' : '';
  
  return `${visibility} ${staticPrefix}${attr.name}: ${attr.type}${arrayNotation}`;
}

/**
 * Formats a method into a display string
 * Example: "+ getName(): String"
 */
function formatMethod(method: ClassMethod): string {
  const visibility = VISIBILITY_SYMBOLS[method.visibility] || '+';
  const staticPrefix = method.isStatic ? 'static ' : '';
  const abstractPrefix = method.isAbstract ? 'abstract ' : '';
  
  const params = method.parameters
    .map(p => {
      const arrayNotation = p.isArray ? '[]' : '';
      return `${p.name}: ${p.type}${arrayNotation}`;
    })
    .join(', ');
  
  const returnArrayNotation = method.isReturnArray ? '[]' : '';
  
  return `${visibility} ${abstractPrefix}${staticPrefix}${method.name}(${params}): ${method.returnType}${returnArrayNotation}`;
}

/**
 * Transforms attributes into a generic section
 */
function transformAttributesSection(attributes: ClassAttribute[]): NodeSection {
  return {
    id: 'attributes',
    items: attributes.map(attr => ({
      id: attr.id,
      text: formatAttribute(attr),
      isStatic: attr.isStatic,
      metadata: {
        name: attr.name,
        type: attr.type,
        visibility: attr.visibility,
        isArray: attr.isArray,
      },
    })),
  };
}

/**
 * Transforms methods into a generic section
 */
function transformMethodsSection(methods: ClassMethod[]): NodeSection {
  return {
    id: 'methods',
    items: methods.map(method => ({
      id: method.id,
      text: formatMethod(method),
      isStatic: method.isStatic,
      isAbstract: method.isAbstract,
      metadata: {
        name: method.name,
        returnType: method.returnType,
        visibility: method.visibility,
        parameters: method.parameters,
      },
    })),
  };
}

/**
 * Transforms enum literals into a generic section
 */
function transformLiteralsSection(literals: Array<{ id: string; name: string; value?: string | number }>): NodeSection {
  return {
    id: 'literals',
    items: literals.map((literal) => ({
      id: literal.id,
      text: literal.value !== undefined ? `${literal.name} = ${literal.value}` : literal.name,
    })),
  };
}

/**
 * Transforms a Class node to NodeViewModel
 */
function transformClassNode(node: ClassNode): NodeViewModel {
  const sections: NodeSection[] = [];
  
  // Add attributes section
  if (node.attributes.length > 0) {
    sections.push(transformAttributesSection(node.attributes));
  }
  
  // Add methods section
  if (node.methods.length > 0) {
    sections.push(transformMethodsSection(node.methods));
  }
  
  return {
    id: node.id,
    domainId: node.id,
    label: node.name,
    sublabel: node.generics,
    stereotype: undefined, // Class doesn't show stereotype
    badge: node.package,
    sections,
    style: STYLE_CONFIGS.CLASS,
    metadata: {
      isMain: node.isMain,
      package: node.package,
    },
  };
}

/**
 * Transforms an Interface node to NodeViewModel
 */
function transformInterfaceNode(node: InterfaceNode): NodeViewModel {
  const sections: NodeSection[] = [];
  
  // Interfaces only have methods
  if (node.methods.length > 0) {
    sections.push(transformMethodsSection(node.methods));
  }
  
  return {
    id: node.id,
    domainId: node.id,
    label: node.name,
    sublabel: node.generics,
    stereotype: STEREOTYPE_LABELS.INTERFACE,
    badge: node.package,
    sections,
    style: STYLE_CONFIGS.INTERFACE,
    metadata: {
      package: node.package,
    },
  };
}

/**
 * Transforms an Abstract Class node to NodeViewModel
 */
function transformAbstractClassNode(node: AbstractClassNode): NodeViewModel {
  const sections: NodeSection[] = [];
  
  // Add attributes section
  if (node.attributes.length > 0) {
    sections.push(transformAttributesSection(node.attributes));
  }
  
  // Add methods section
  if (node.methods.length > 0) {
    sections.push(transformMethodsSection(node.methods));
  }
  
  return {
    id: node.id,
    domainId: node.id,
    label: node.name,
    sublabel: node.generics,
    stereotype: STEREOTYPE_LABELS.ABSTRACT_CLASS,
    badge: node.package,
    sections,
    style: STYLE_CONFIGS.ABSTRACT_CLASS,
    metadata: {
      package: node.package,
    },
  };
}

/**
 * Transforms an Enum node to NodeViewModel
 */
function transformEnumNode(node: EnumNode): NodeViewModel {
  const sections: NodeSection[] = [];
  
  // Add literals section
  if (node.literals.length > 0) {
    sections.push(transformLiteralsSection(node.literals));
  }
  
  return {
    id: node.id,
    domainId: node.id,
    label: node.name,
    stereotype: STEREOTYPE_LABELS.ENUM,
    badge: node.package,
    sections,
    style: STYLE_CONFIGS.ENUM,
    metadata: {
      package: node.package,
    },
  };
}

/**
 * Transforms a Note node to NoteViewModel
 */
function transformNoteNode(node: NoteNode): NoteViewModel {
  return {
    id: node.id,
    domainId: node.id,
    title: undefined, // Notes don't have titles in current implementation
    content: node.content,
  };
}

/**
 * Main transformer function: Domain Node -> View Model
 * 
 * This is the ONLY place where domain types are accessed.
 * UI components receive the generic NodeViewModel.
 */
export function transformDomainNodeToViewModel(node: DomainNode): AnyNodeViewModel {
  switch (node.type) {
    case 'CLASS':
      return transformClassNode(node as ClassNode);
    
    case 'INTERFACE':
      return transformInterfaceNode(node as InterfaceNode);
    
    case 'ABSTRACT_CLASS':
      return transformAbstractClassNode(node as AbstractClassNode);
    
    case 'ENUM':
      return transformEnumNode(node as EnumNode);
    
    case 'NOTE':
      return transformNoteNode(node as NoteNode);
    
    // Use Case Diagram nodes (future implementation)
    case 'ACTOR':
    case 'USE_CASE':
    case 'SYSTEM_BOUNDARY': {
      // For now, return a minimal view model
      const anyNode = node as any;
      return {
        id: anyNode.id,
        domainId: anyNode.id,
        label: anyNode.name || 'Unnamed',
        sections: [],
        style: STYLE_CONFIGS.CLASS, // Default style
      };
    }
    
    default: {
      // Fallback for unknown types
      const unknownNode = node as any;
      return {
        id: unknownNode.id,
        domainId: unknownNode.id,
        label: 'Unknown Node',
        sections: [],
        style: STYLE_CONFIGS.CLASS,
      };
    }
  }
}
