/**
 * DiagramValidator.ts
 * 
 * Valida la estructura de un diagrama antes de export/import.
 * 
 * Responsabilidades:
 * - Validar que view.nodes tenga datos válidos
 * - Validar que parentPackageId apunte a nodos existentes
 * - Validar que elementId exista en el modelo
 * - Validar posiciones y dimensiones
 * - Validar integridad referencial
 * 
 * Reglas de validación:
 * 1. Estructura básica: nodes y edges son arrays
 * 2. ViewNode: tiene id, x, y válidos
 * 3. Posiciones no negativas
 * 4. parentPackageId apunta a nodo existente
 * 5. elementId existe en el modelo (excepto notas)
 * 6. Dimensiones no negativas
 * 7. No hay ciclos en parentPackageId
 */

import type {
  DiagramView,
  SemanticModel,
  ViewNode,
  ViewEdge,
} from '../../../core/domain/vfs/vfs.types';
import type { PartialSemanticModel } from '../extraction/ModelExtractor';

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class DiagramValidator {
  /**
   * Validates a complete diagram
   * 
   * @param view - Diagram view
   * @param model - Semantic model (complete or partial)
   * @returns ValidationResult - Result with errors if any
   * 
   * @example
   * ```typescript
   * const validator = new DiagramValidator();
   * const result = validator.validate(view, model);
   * if (!result.isValid) {
   *   console.error('Validation errors:', result.errors);
   * }
   * ```
   */
  validate(
    view: DiagramView,
    model: SemanticModel | PartialSemanticModel,
  ): ValidationResult {
    const errors: string[] = [];
    
    // 1. Validate basic structure
    if (!view.nodes || !Array.isArray(view.nodes)) {
      errors.push('view.nodes must be an array');
    }
    if (!view.edges || !Array.isArray(view.edges)) {
      errors.push('view.edges must be an array');
    }
    
    // If basic structure is invalid, don't continue
    if (errors.length > 0) {
      return { isValid: false, errors };
    }
    
    // 2. Validate each node
    this.validateNodes(view.nodes, model, errors);
    
    // 3. Validate each edge
    this.validateEdges(view.edges, model, errors);
    
    // 4. Validate package hierarchy (no cycles)
    this.validatePackageHierarchy(view.nodes, errors);
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates all diagram nodes
   */
  private validateNodes(
    nodes: ViewNode[],
    model: SemanticModel | PartialSemanticModel,
    errors: string[],
  ): void {
    const nodeIds = new Set(nodes.map(n => n.id));
    
    for (const node of nodes) {
      // Validate required fields
      if (!node.id) {
        errors.push('Node missing id');
        continue;
      }
      
      if (node.x === undefined || node.x === null) {
        errors.push(`Node ${node.id} missing x coordinate`);
      }
      
      if (node.y === undefined || node.y === null) {
        errors.push(`Node ${node.id} missing y coordinate`);
      }
      
      // Validate non-negative positions
      if (typeof node.x === 'number' && node.x < 0) {
        errors.push(`Node ${node.id} has negative x position: ${node.x}`);
      }
      
      if (typeof node.y === 'number' && node.y < 0) {
        errors.push(`Node ${node.id} has negative y position: ${node.y}`);
      }
      
      // Validate non-negative dimensions (if they exist)
      if (node.width !== undefined && node.width < 0) {
        errors.push(`Node ${node.id} has negative width: ${node.width}`);
      }
      
      if (node.height !== undefined && node.height < 0) {
        errors.push(`Node ${node.id} has negative height: ${node.height}`);
      }
      
      // Validate parentPackageId points to existing node
      if (node.parentPackageId && !nodeIds.has(node.parentPackageId)) {
        errors.push(
          `Node ${node.id} has invalid parentPackageId: ${node.parentPackageId} (node does not exist)`
        );
      }
      
      // Validate elementId exists in model (except notes with empty elementId)
      if (node.elementId && !this.elementExistsInModel(node.elementId, model)) {
        errors.push(
          `Node ${node.id} references non-existent element: ${node.elementId}`
        );
      }
    }
  }

  /**
   * Validates all diagram edges
   */
  private validateEdges(
    edges: ViewEdge[],
    model: SemanticModel | PartialSemanticModel,
    errors: string[],
  ): void {
    for (const edge of edges) {
      // Validate required fields
      if (!edge.id) {
        errors.push('Edge missing id');
        continue;
      }
      
      if (!edge.relationId) {
        errors.push(`Edge ${edge.id} missing relationId`);
        continue;
      }
      
      // Validate relationId exists in model
      if (!model.relations[edge.relationId]) {
        errors.push(
          `Edge ${edge.id} references non-existent relation: ${edge.relationId}`
        );
      }
    }
  }

  /**
   * Validates that there are no cycles in the package hierarchy
   * 
   * A cycle would be: A.parentPackageId = B, B.parentPackageId = A
   */
  private validatePackageHierarchy(
    nodes: ViewNode[],
    errors: string[],
  ): void {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    for (const node of nodes) {
      if (!node.parentPackageId) continue;
      
      // Detect cycles by following the parentPackageId chain
      const visited = new Set<string>([node.id]);
      let currentId: string | null | undefined = node.parentPackageId;
      
      while (currentId) {
        if (visited.has(currentId)) {
          errors.push(
            `Circular package hierarchy detected: node ${node.id} has a cycle in its parent chain`
          );
          break;
        }
        
        visited.add(currentId);
        const parent = nodeMap.get(currentId);
        if (!parent) break;
        
        currentId = parent.parentPackageId;
        
        // Protection against infinite loops
        if (visited.size > nodes.length) {
          errors.push(
            `Package hierarchy too deep for node ${node.id} (possible infinite loop)`
          );
          break;
        }
      }
    }
  }

  /**
   * Verifies if an element exists in the model
   */
  private elementExistsInModel(
    elementId: string,
    model: SemanticModel | PartialSemanticModel,
  ): boolean {
    return !!(
      model.classes[elementId] ||
      model.interfaces[elementId] ||
      model.enums[elementId] ||
      model.packages[elementId] ||
      model.dataTypes?.[elementId] ||
      model.actors?.[elementId] ||
      model.useCases?.[elementId] ||
      model.components?.[elementId] ||
      model.nodes?.[elementId] ||
      model.artifacts?.[elementId]
    );
  }
}
