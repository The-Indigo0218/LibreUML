/**
 * DiagramIOServiceFactory.ts
 * 
 * Factory to create DiagramIOService instances with all their dependencies.
 * 
 * Responsibilities:
 * - Create serializer, deserializer, validator, extractor
 * - Inject store access (VFS, Model)
 * - Provide singleton instance
 * - Allow reset for tests
 * 
 * Pattern: Singleton Factory
 * 
 * Usage:
 * ```typescript
 * import { getDiagramIOService } from './DiagramIOServiceFactory';
 * 
 * const service = getDiagramIOService();
 * await service.exportDiagram(fileId);
 * ```
 */

import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import { DiagramIOService } from './DiagramIOService';
import { DiagramSerializer } from './serialization/DiagramSerializer';
import { DiagramDeserializer } from './serialization/DiagramDeserializer';
import { DiagramValidator } from './validation/DiagramValidator';
import { ModelExtractor } from './extraction/ModelExtractor';
import { FormatDetector } from './serialization/FormatDetector';

/**
 * Factory to create DiagramIOService instances
 */
class DiagramIOServiceFactory {
  private instance: DiagramIOService | null = null;

  /**
   * Creates or returns the singleton service instance
   * 
   * @returns DiagramIOService - Service instance
   * 
   * @example
   * ```typescript
   * const factory = new DiagramIOServiceFactory();
   * const service = factory.create();
   * await service.exportDiagram('diagram-123');
   * ```
   */
  create(): DiagramIOService {
    if (!this.instance) {
      // Create dependencies
      const serializer = new DiagramSerializer();
      const formatDetector = new FormatDetector();
      const deserializer = new DiagramDeserializer(formatDetector);
      const validator = new DiagramValidator();
      const extractor = new ModelExtractor();

      // Create service with store access
      // We use getters to access current store state
      this.instance = new DiagramIOService(
        serializer,
        deserializer,
        validator,
        extractor,
        () => useVFSStore.getState(),
        () => useModelStore.getState(),
      );
    }

    return this.instance;
  }

  /**
   * Resets the instance (useful for tests)
   * 
   * @example
   * ```typescript
   * // In tests
   * afterEach(() => {
   *   diagramIOServiceFactory.reset();
   * });
   * ```
   */
  reset(): void {
    this.instance = null;
  }

  /**
   * Checks if there is a created instance
   */
  hasInstance(): boolean {
    return this.instance !== null;
  }
}

/**
 * Singleton factory instance
 */
export const diagramIOServiceFactory = new DiagramIOServiceFactory();

/**
 * Helper to get the service directly
 * 
 * This is the recommended way to use the service in the application.
 * 
 * @returns DiagramIOService - Service instance
 * 
 * @example
 * ```typescript
 * import { getDiagramIOService } from './services/diagram/DiagramIOServiceFactory';
 * 
 * const service = getDiagramIOService();
 * await service.exportDiagram(fileId);
 * ```
 */
export function getDiagramIOService(): DiagramIOService {
  return diagramIOServiceFactory.create();
}
