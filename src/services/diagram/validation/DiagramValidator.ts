/**
 * DiagramValidator.ts
 *
 * Validates a diagram structure before export/import.
 *
 * Validation rules:
 * 1. nodes and edges must be arrays
 * 2. No duplicate node IDs
 * 3. No duplicate edge IDs
 * 4. parentPackageId must point to an existing node
 * 5. elementId must exist in the model (except notes with empty elementId)
 * 6. Positions and dimensions must not be negative
 * 7. No cycles in parentPackageId chain
 * 8. Warn when diagram has no nodes
 */

import type {
  DiagramView,
  SemanticModel,
  ViewNode,
  ViewEdge,
} from '../../../core/domain/vfs/vfs.types';
import type { PartialSemanticModel } from '../extraction/ModelExtractor';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class DiagramValidator {
  validate(
    view: DiagramView,
    model: SemanticModel | PartialSemanticModel,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!view.nodes || !Array.isArray(view.nodes)) {
      errors.push('View must have a nodes array');
    }
    if (!view.edges || !Array.isArray(view.edges)) {
      errors.push('View must have an edges array');
    }

    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }

    this.validateNodes(view.nodes, model, errors);
    this.validateEdges(view.edges, model, errors);
    this.validatePackageHierarchy(view.nodes, errors);

    if (view.nodes.length === 0) {
      warnings.push('Diagram is empty (no nodes)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateNodes(
    nodes: ViewNode[],
    model: SemanticModel | PartialSemanticModel,
    errors: string[],
  ): void {
    const nodeIds = new Set<string>();

    for (const node of nodes) {
      if (!node.id) {
        errors.push('Node missing id');
        continue;
      }

      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID: ${node.id}`);
      } else {
        nodeIds.add(node.id);
      }

      if (node.x === undefined || node.x === null) {
        errors.push(`Node ${node.id} missing x coordinate`);
      }

      if (node.y === undefined || node.y === null) {
        errors.push(`Node ${node.id} missing y coordinate`);
      }

      if (typeof node.x === 'number' && node.x < 0) {
        errors.push(`Node ${node.id} has negative x position: ${node.x}`);
      }

      if (typeof node.y === 'number' && node.y < 0) {
        errors.push(`Node ${node.id} has negative y position: ${node.y}`);
      }

      if (node.width !== undefined && node.width < 0) {
        errors.push(`Node ${node.id} has negative width: ${node.width}`);
      }

      if (node.height !== undefined && node.height < 0) {
        errors.push(`Node ${node.id} has negative height: ${node.height}`);
      }

      if (node.parentPackageId && !nodeIds.has(node.parentPackageId)) {
        // Check in full node list (nodeIds may not have all nodes yet due to iteration order)
        const allIds = new Set(nodes.map(n => n.id));
        if (!allIds.has(node.parentPackageId)) {
          errors.push(
            `Node ${node.id} references non-existent parent package ${node.parentPackageId}`
          );
        }
      }

      if (node.elementId && !this.elementExistsInModel(node.elementId, model)) {
        errors.push(
          `Node ${node.id} references non-existent element ${node.elementId}`
        );
      }
    }
  }

  private validateEdges(
    edges: ViewEdge[],
    model: SemanticModel | PartialSemanticModel,
    errors: string[],
  ): void {
    const edgeIds = new Set<string>();

    for (const edge of edges) {
      if (!edge.id) {
        errors.push('Edge missing id');
        continue;
      }

      if (edgeIds.has(edge.id)) {
        errors.push(`Duplicate edge ID: ${edge.id}`);
      } else {
        edgeIds.add(edge.id);
      }

      if (!edge.relationId) {
        errors.push(`Edge ${edge.id} missing relationId`);
        continue;
      }

      if (!model.relations[edge.relationId]) {
        errors.push(
          `Edge ${edge.id} references non-existent relation ${edge.relationId}`
        );
      }
    }
  }

  private validatePackageHierarchy(
    nodes: ViewNode[],
    errors: string[],
  ): void {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    for (const node of nodes) {
      if (!node.parentPackageId) continue;

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

        if (visited.size > nodes.length) {
          errors.push(
            `Package hierarchy too deep for node ${node.id} (possible infinite loop)`
          );
          break;
        }
      }
    }
  }

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
