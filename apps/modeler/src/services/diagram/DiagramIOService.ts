/**
 * DiagramIOService.ts
 * 
 * Main service for import/export of single diagrams.
 * Replaces exportDiagram() and importDiagram() functions from projectIO.service.ts
 * 
 * Responsibilities:
 * - Orchestrate diagram export to flat JSON
 * - Orchestrate diagram import from JSON/ZIP
 * - Coordinate validation, extraction and serialization
 * - Handle errors consistently
 * - Access stores in a controlled way
 * 
 * Export Flow:
 * 1. Get data from store (VFS + Model)
 * 2. Validate diagram structure
 * 3. Extract partial model (only used elements)
 * 4. Create JSON payload
 * 5. Serialize to string
 * 6. Download file
 * 
 * Import Flow:
 * 1. Read file
 * 2. Detect format (JSON vs ZIP)
 * 3. Deserialize according to format
 * 4. Validate structure
 * 5. Return parsed data
 */

import type { VFSStore } from '../../store/project-vfs.store';
import type { ModelStore } from '../../store/model.store';
import type { VFSFile, DiagramView, SemanticModel } from '../../core/domain/vfs/vfs.types';
import { DiagramSerializer, type DiagramPayload } from './serialization/DiagramSerializer';
import { DiagramDeserializer } from './serialization/DiagramDeserializer';
import { DiagramValidator } from './validation/DiagramValidator';
import { ModelExtractor } from './extraction/ModelExtractor';

/**
 * Diagram import result
 */
export interface ParsedDiagram {
  name: string;
  view: DiagramView;
  model: SemanticModel;
}

/**
 * Diagram export error
 */
export class DiagramExportError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'DiagramExportError';
    this.cause = cause;
  }
}

/**
 * Diagram import error
 */
export class DiagramImportError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'DiagramImportError';
    this.cause = cause;
  }
}

export class DiagramIOService {
  private readonly serializer: DiagramSerializer;
  private readonly deserializer: DiagramDeserializer;
  private readonly validator: DiagramValidator;
  private readonly extractor: ModelExtractor;
  private readonly getVFSStore: () => VFSStore;
  private readonly getModelStore: () => ModelStore;

  constructor(
    serializer: DiagramSerializer,
    deserializer: DiagramDeserializer,
    validator: DiagramValidator,
    extractor: ModelExtractor,
    getVFSStore: () => VFSStore,
    getModelStore: () => ModelStore,
  ) {
    this.serializer = serializer;
    this.deserializer = deserializer;
    this.validator = validator;
    this.extractor = extractor;
    this.getVFSStore = getVFSStore;
    this.getModelStore = getModelStore;
  }

  /**
   * Exports a single diagram as flat JSON
   * 
   * @param fileId - VFS file ID of the diagram
   * @returns Promise<void> - Downloads the file
   * @throws DiagramExportError if there are problems
   * 
   * @example
   * ```typescript
   * const service = getDiagramIOService();
   * await service.exportDiagram('diagram-123');
   * // Downloads diagram-123.luml
   * ```
   */
  async exportDiagram(fileId: string): Promise<void> {
    try {
      // 1. Get data from store
      const { file, view, model } = this.getDiagramData(fileId);
      
      // 2. Validate structure
      const validation = this.validator.validate(view, model);
      if (!validation.isValid) {
        throw new DiagramExportError(
          `Diagram validation failed:\n${validation.errors.map(e => `  - ${e}`).join('\n')}`
        );
      }
      
      // 3. Extract partial model
      const partialModel = this.extractor.extractPartialModel(view, model);
      
      // 4. Create payload
      const payload: DiagramPayload = DiagramSerializer.createPayload({
        diagramId: fileId,
        diagramName: file.name.replace(/\.luml$/i, ''),
        model: partialModel,
        view: view,
      });
      
      // 5. Serialize to JSON
      const json = this.serializer.serialize(payload);
      
      // 6. Download
      await this.downloadFile(json, payload.diagramName);
    } catch (error) {
      if (error instanceof DiagramExportError) {
        throw error;
      }
      throw new DiagramExportError(
        'Failed to export diagram',
        error
      );
    }
  }

  /**
   * Imports a diagram from .luml file (JSON or ZIP)
   * 
   * @param file - File to import
   * @returns Promise<ParsedDiagram> - Parsed diagram
   * @throws DiagramImportError if there are problems
   * 
   * @example
   * ```typescript
   * const service = getDiagramIOService();
   * const diagram = await service.importDiagram(file);
   * // diagram contains name, view, model
   * ```
   */
  async importDiagram(file: File): Promise<ParsedDiagram> {
    try {
      // 1. Detect format
      const format = await this.deserializer.detectFormat(file);
      
      // 2. Deserialize according to format
      const payload = await this.deserializer.deserialize(file, format);
      
      // 3. Validate structure
      const validation = this.validator.validate(payload.view, payload.model);
      if (!validation.isValid) {
        throw new DiagramImportError(
          `Diagram validation failed:\n${validation.errors.map(e => `  - ${e}`).join('\n')}`
        );
      }
      
      // 4. Return parsed data
      return {
        name: payload.diagramName,
        view: payload.view,
        model: payload.model as SemanticModel,
      };
    } catch (error) {
      if (error instanceof DiagramImportError) {
        throw error;
      }
      throw new DiagramImportError(
        'Failed to import diagram',
        error
      );
    }
  }

  /**
   * Gets diagram data from stores
   */
  private getDiagramData(fileId: string): {
    file: VFSFile;
    view: DiagramView;
    model: SemanticModel;
  } {
    const vfsStore = this.getVFSStore();
    const modelStore = this.getModelStore();
    
    const project = vfsStore.project;
    if (!project) {
      throw new DiagramExportError('No active project');
    }
    
    const fileNode = project.nodes[fileId];
    if (!fileNode || fileNode.type !== 'FILE') {
      throw new DiagramExportError(`Invalid file: ${fileId}`);
    }
    
    const file = fileNode as VFSFile;
    
    // Validate that it has content
    if (!file.content) {
      throw new DiagramExportError('Diagram has no content');
    }
    
    const view = file.content as DiagramView;
    
    // Validate that it has nodes and edges
    if (!view.nodes || !view.edges) {
      throw new DiagramExportError('Invalid diagram view: missing nodes or edges');
    }
    
    const model = modelStore.model;
    if (!model) {
      throw new DiagramExportError('No semantic model loaded');
    }
    
    return { file, view, model };
  }

  /**
   * Downloads file in browser or Electron
   */
  private async downloadFile(content: string, fileName: string): Promise<void> {
    const blob = new Blob([content], { type: 'application/json' });
    const safeFileName = this.sanitizeFileName(fileName);

    // Electron
    if (window.electronAPI?.isElectron()) {
      const dataUrl = await this.blobToDataURL(blob);
      const result = await window.electronAPI.saveFile(dataUrl, safeFileName, 'json');
      if (result.canceled) {
        throw new DiagramExportError('Export canceled by user');
      }
      return;
    }

    // Browser
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFileName;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Sanitizes file name
   */
  private sanitizeFileName(fileName: string): string {
    // Remove invalid characters
    const sanitized = fileName.replace(/[^a-z0-9_-]/gi, '_');
    // Ensure .luml extension
    return sanitized.endsWith('.luml') ? sanitized : `${sanitized}.luml`;
  }

  /**
   * Converts Blob to Data URL (for Electron)
   */
  private blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
