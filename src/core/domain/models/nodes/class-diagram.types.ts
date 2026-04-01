import type { BaseDomainNode, Visibility, Packageable, Documentable } from './base.types';

/**
 * Class Diagram Node Types (Discriminated Union)
 */
export type ClassDiagramNodeType =
  | 'CLASS'
  | 'INTERFACE'
  | 'ABSTRACT_CLASS'
  | 'ENUM'
  | 'NOTE';

/**
 * Attribute definition (pure domain)
 */
export interface ClassAttribute {
  id: string;
  name: string;
  type: string;
  visibility: Visibility;
  isArray: boolean;
  isStatic?: boolean;
  isReadOnly?: boolean;
  defaultValue?: string;
}

/**
 * Method parameter definition
 */
export interface MethodParameter {
  name: string;
  type: string;
  isArray?: boolean;
  defaultValue?: string;
}

/**
 * Method definition (pure domain)
 */
export interface ClassMethod {
  id: string;
  name: string;
  returnType: string;
  visibility: Visibility;
  parameters: Array<{ name: string; type: string }>;
  isStatic?: boolean;
  isAbstract?: boolean;
  isConstructor?: boolean;
}

/**
 * Class Node (SSOT Domain Model)
 */
export interface ClassNode extends BaseDomainNode, Packageable, Documentable {
  type: 'CLASS';
  name: string;
  generics?: string;
  attributes: ClassAttribute[];
  methods: ClassMethod[];
  isMain?: boolean;
}

/**
 * Interface Node (SSOT Domain Model)
 */
export interface InterfaceNode extends BaseDomainNode, Packageable, Documentable {
  type: 'INTERFACE';
  name: string;
  generics?: string;
  methods: ClassMethod[]; // Interfaces have methods, no attributes
}

/**
 * Abstract Class Node (SSOT Domain Model)
 */
export interface AbstractClassNode extends BaseDomainNode, Packageable, Documentable {
  type: 'ABSTRACT_CLASS';
  name: string;
  generics?: string;
  attributes: ClassAttribute[];
  methods: ClassMethod[];
}

/**
 * Enum Node (SSOT Domain Model)
 */
export interface EnumNode extends BaseDomainNode, Packageable, Documentable {
  type: 'ENUM';
  name: string;
  literals: Array<{
    id: string;
    name: string;
    value?: string | number;
  }>;
}

/**
 * Note Node (SSOT Domain Model)
 */
export interface NoteNode extends BaseDomainNode {
  type: 'NOTE';
  content: string;
  backgroundColor?: string;
}

/**
 * Discriminated Union of all Class Diagram nodes
 */
export type ClassDiagramNode =
  | ClassNode
  | InterfaceNode
  | AbstractClassNode
  | EnumNode
  | NoteNode;
