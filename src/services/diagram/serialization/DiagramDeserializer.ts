/**
 * DiagramDeserializer.ts
 * 
 * Deserializa diagramas desde JSON plano (v2.0) o ZIP (legacy)
 * 
 * Responsabilidades:
 * - Detectar formato automáticamente
 * - Parsear JSON plano
 * - Parsear ZIP legacy (retrocompatibilidad)
 * - Validar estructura básica
 * - Retornar payload normalizado
 * 
 * Formatos soportados:
 * - JSON plano v2.0 (nuevo)
 * - ZIP v2.0 (legacy, retrocompatibilidad)
 */

import JSZip from 'jszip';
import type { DiagramPayload } from './DiagramSerializer';
import { FormatDetector, type DiagramFormat } from './FormatDetector';

/**
 * Error de deserialización
 */
export class DeserializationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DeserializationError';
  }
}

export class DiagramDeserializer {
  constructor(
    private readonly formatDetector: FormatDetector,
  ) {}

  /**
   * Detecta el formato del archivo
   * 
   * @param file - Archivo a analizar
   * @returns Promise<DiagramFormat> - Formato detectado
   */
  async detectFormat(file: File | Blob): Promise<DiagramFormat> {
    return this.formatDetector.detect(file);
  }

  /**
   * Deserializa un archivo según su formato
   * 
   * @param file - Archivo a deserializar
   * @param format - Formato detectado (opcional, se detecta automáticamente si no se provee)
   * @returns Promise<DiagramPayload> - Payload normalizado
   * @throws DeserializationError si hay problemas
   * 
   * @example
   * ```typescript
   * const deserializer = new DiagramDeserializer(formatDetector);
   * const payload = await deserializer.deserialize(file);
   * // payload está normalizado a formato v2.0
   * ```
   */
  async deserialize(
    file: File | Blob,
    format?: DiagramFormat,
  ): Promise<DiagramPayload> {
    try {
      // Detectar formato si no se provee
      const detectedFormat = format ?? await this.detectFormat(file);
      
      if (detectedFormat === 'json') {
        return await this.deserializeJSON(file);
      } else {
        return await this.deserializeZIP(file);
      }
    } catch (error) {
      if (error instanceof DeserializationError) {
        throw error;
      }
      throw new DeserializationError(
        'Failed to deserialize diagram file',
        error
      );
    }
  }

  /**
   * Deserializa JSON plano (formato v2.0)
   */
  private async deserializeJSON(file: File | Blob): Promise<DiagramPayload> {
    try {
      // Leer contenido del archivo
      const text = await this.readAsText(file);
      
      // Parsear JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        throw new DeserializationError(
          'Invalid JSON format: file contains malformed JSON',
          error
        );
      }
      
      // Validar estructura básica
      if (!parsed || typeof parsed !== 'object') {
        throw new DeserializationError(
          'Invalid JSON format: root must be an object'
        );
      }
      
      const payload = parsed as Record<string, unknown>;
      
      // Validar campos requeridos
      if (!payload._lumlVersion) {
        throw new DeserializationError(
          'Invalid format: missing _lumlVersion field'
        );
      }
      
      if (payload.exportType !== 'diagram') {
        throw new DeserializationError(
          `Invalid format: exportType must be "diagram", got "${payload.exportType}"`
        );
      }
      
      if (!payload.diagramId || typeof payload.diagramId !== 'string') {
        throw new DeserializationError(
          'Invalid format: missing or invalid diagramId'
        );
      }
      
      if (!payload.diagramName || typeof payload.diagramName !== 'string') {
        throw new DeserializationError(
          'Invalid format: missing or invalid diagramName'
        );
      }
      
      if (!payload.model || typeof payload.model !== 'object') {
        throw new DeserializationError(
          'Invalid format: missing or invalid model'
        );
      }
      
      if (!payload.view || typeof payload.view !== 'object') {
        throw new DeserializationError(
          'Invalid format: missing or invalid view'
        );
      }
      
      return payload as DiagramPayload;
    } catch (error) {
      if (error instanceof DeserializationError) {
        throw error;
      }
      throw new DeserializationError(
        'Failed to deserialize JSON diagram',
        error
      );
    }
  }

  /**
   * Deserializa ZIP legacy (retrocompatibilidad con formato viejo)
   * 
   * Estructura ZIP:
   * - project.json: { exportType, diagramId, diagramName }
   * - domain.model: SemanticModel parcial
   * - diagrams/{id}.json: DiagramView
   */
  private async deserializeZIP(file: File | Blob): Promise<DiagramPayload> {
    try {
      // Abrir ZIP
      const zip = await JSZip.loadAsync(file);
      
      // Leer project.json
      const projectEntry = zip.file('project.json');
      if (!projectEntry) {
        throw new DeserializationError(
          'Invalid ZIP format: missing project.json'
        );
      }
      
      const manifestText = await projectEntry.async('string');
      const manifest = JSON.parse(manifestText) as Record<string, unknown>;
      
      // Validar manifest
      if (!manifest.diagramId || typeof manifest.diagramId !== 'string') {
        throw new DeserializationError(
          'Invalid ZIP format: project.json missing diagramId'
        );
      }
      
      if (!manifest.diagramName || typeof manifest.diagramName !== 'string') {
        throw new DeserializationError(
          'Invalid ZIP format: project.json missing diagramName'
        );
      }
      
      // Leer domain.model
      const modelEntry = zip.file('domain.model');
      if (!modelEntry) {
        throw new DeserializationError(
          'Invalid ZIP format: missing domain.model'
        );
      }
      
      const modelText = await modelEntry.async('string');
      const model = JSON.parse(modelText);
      
      // Leer diagrams/{id}.json
      const diagramEntry = zip.file(`diagrams/${manifest.diagramId}.json`);
      if (!diagramEntry) {
        throw new DeserializationError(
          `Invalid ZIP format: missing diagrams/${manifest.diagramId}.json`
        );
      }
      
      const viewText = await diagramEntry.async('string');
      const view = JSON.parse(viewText);
      
      // Normalizar a formato v2.0
      return {
        _lumlVersion: '2.0',
        exportType: 'diagram',
        diagramId: manifest.diagramId as string,
        diagramName: manifest.diagramName as string,
        model: model,
        view: view,
      };
    } catch (error) {
      if (error instanceof DeserializationError) {
        throw error;
      }
      throw new DeserializationError(
        'Failed to deserialize ZIP diagram',
        error
      );
    }
  }

  /**
   * Lee un archivo como texto
   */
  private async readAsText(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}
