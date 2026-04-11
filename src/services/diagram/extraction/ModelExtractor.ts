/**
 * ModelExtractor.ts
 * 
 * Extracts a partial semantic model from the complete model based on
 * the elements referenced in a DiagramView.
 * 
 * Responsibilities:
 * - Extract only elements referenced in the diagram
 * - Extract attributes and operations of those elements
 * - Extract relations between those elements
 * - Maintain referential integrity
 * 
 * Strategy:
 * - Only include elements that appear in view.nodes
 * - Only include relations that connect visible elements
 * - Include dependencies (attributes, operations, packages)
 */

import type {
  SemanticModel,
  DiagramView,
  IRClass,
  IRInterface,
  IREnum,
  IRPackage,
} from '../../../core/domain/vfs/vfs.types';

/**
 * Partial semantic model (only diagram elements)
 */
export interface PartialSemanticModel {
  id: string;
  name: string;
  version: string;
  packages: Record<string, IRPackage>;
  classes: Record<string, IRClass>;
  interfaces: Record<string, IRInterface>;
  enums: Record<string, IREnum>;
  dataTypes: Record<string, any>;
  attributes: Record<string, any>;
  operations: Record<string, any>;
  relations: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export class ModelExtractor {
  /**
   * Extracts partial model based on the DiagramView
   * 
   * @param view - Diagram view with nodes and edges
   * @param fullModel - Complete semantic model
   * @returns PartialSemanticModel - Model with only used elements
   * 
   * @example
   * ```typescript
   * const extractor = new ModelExtractor();
   * const partial = extractor.extractPartialModel(view, fullModel);
   * // partial solo contiene elementos referenciados en view.nodes
   * ```
   */
  extractPartialModel(
    view: DiagramView,
    fullModel: SemanticModel,
  ): PartialSemanticModel {
    // 1. Collect referenced element IDs
    const elementIds = new Set(
      view.nodes
        .map(n => n.elementId)
        .filter(id => id !== '') // Exclude notes (empty elementId)
    );
    
    // 2. Collect referenced relation IDs
    const relationIds = new Set(
      view.edges.map(e => e.relationId)
    );
    
    // 3. Create empty partial model
    const partial = this.createEmptyModel(fullModel);
    
    // 4. Extract elements
    for (const elementId of elementIds) {
      this.extractElement(elementId, fullModel, partial);
    }
    
    // 5. Extract relations (only those connecting visible elements)
    for (const relationId of relationIds) {
      const relation = fullModel.relations[relationId];
      if (relation) {
        // Verify both ends are in the diagram
        if (elementIds.has(relation.sourceId) && elementIds.has(relation.targetId)) {
          partial.relations[relationId] = relation;
        }
      }
    }
    
    return partial;
  }

  /**
   * Creates an empty partial model with metadata from the complete model
   */
  private createEmptyModel(fullModel: SemanticModel): PartialSemanticModel {
    return {
      id: fullModel.id,
      name: 'Diagram Snapshot',
      version: fullModel.version,
      packages: {},
      classes: {},
      interfaces: {},
      enums: {},
      dataTypes: {},
      attributes: {},
      operations: {},
      relations: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Extracts an element and its dependencies from the complete model
   * 
   * @param elementId - ID of the element to extract
   * @param fullModel - Complete model
   * @param partial - Partial model where to add the element
   */
  private extractElement(
    elementId: string,
    fullModel: SemanticModel,
    partial: PartialSemanticModel,
  ): void {
    // Extract class
    if (fullModel.classes[elementId]) {
      this.extractClass(elementId, fullModel, partial);
      return;
    }
    
    // Extract interface
    if (fullModel.interfaces[elementId]) {
      this.extractInterface(elementId, fullModel, partial);
      return;
    }
    
    // Extract enum
    if (fullModel.enums[elementId]) {
      this.extractEnum(elementId, fullModel, partial);
      return;
    }
    
    // Extract package
    if (fullModel.packages[elementId]) {
      this.extractPackage(elementId, fullModel, partial);
      return;
    }
  }

  /**
   * Extracts a class with its attributes and operations
   */
  private extractClass(
    classId: string,
    fullModel: SemanticModel,
    partial: PartialSemanticModel,
  ): void {
    const cls = fullModel.classes[classId];
    if (!cls) return;

    // Add the class
    partial.classes[classId] = cls;
    
    // Extract attributes
    for (const attrId of cls.attributeIds) {
      if (fullModel.attributes[attrId]) {
        partial.attributes[attrId] = fullModel.attributes[attrId];
      }
    }
    
    // Extract operations
    for (const opId of cls.operationIds) {
      if (fullModel.operations[opId]) {
        partial.operations[opId] = fullModel.operations[opId];
      }
    }
    
    // Extract package if exists
    if (cls.packageId && fullModel.packages[cls.packageId]) {
      partial.packages[cls.packageId] = fullModel.packages[cls.packageId];
    }
  }

  /**
   * Extracts an interface with its operations
   */
  private extractInterface(
    interfaceId: string,
    fullModel: SemanticModel,
    partial: PartialSemanticModel,
  ): void {
    const iface = fullModel.interfaces[interfaceId];
    if (!iface) return;

    // Add the interface
    partial.interfaces[interfaceId] = iface;
    
    // Extract operations
    for (const opId of iface.operationIds) {
      if (fullModel.operations[opId]) {
        partial.operations[opId] = fullModel.operations[opId];
      }
    }
    
    // Extract package if exists
    if (iface.packageId && fullModel.packages[iface.packageId]) {
      partial.packages[iface.packageId] = fullModel.packages[iface.packageId];
    }
  }

  /**
   * Extracts an enum
   */
  private extractEnum(
    enumId: string,
    fullModel: SemanticModel,
    partial: PartialSemanticModel,
  ): void {
    const enm = fullModel.enums[enumId];
    if (!enm) return;

    // Add the enum
    partial.enums[enumId] = enm;
    
    // Extract package if exists
    if (enm.packageId && fullModel.packages[enm.packageId]) {
      partial.packages[enm.packageId] = fullModel.packages[enm.packageId];
    }
  }

  /**
   * Extracts a package
   */
  private extractPackage(
    packageId: string,
    fullModel: SemanticModel,
    partial: PartialSemanticModel,
  ): void {
    const pkg = fullModel.packages[packageId];
    if (!pkg) return;

    // Add the package
    partial.packages[packageId] = pkg;
  }
}
