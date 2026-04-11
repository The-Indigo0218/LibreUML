/**
 * FormatDetector.ts
 * 
 * Detecta automáticamente el formato de un archivo .luml
 * 
 * Responsabilidades:
 * - Distinguir entre JSON plano y ZIP
 * - Validar que sea un formato soportado
 * - Retornar formato para deserialización
 * 
 * Estrategia de detección:
 * 1. Leer primeros 4 bytes del archivo
 * 2. Si empieza con 'PK' (0x50 0x4B) → ZIP
 * 3. Si empieza con '{' (0x7B) → JSON
 * 4. Sino → Error
 * 
 * Magic numbers:
 * - ZIP: 0x50 0x4B 0x03 0x04 (PK..)
 * - JSON: 0x7B ({)
 */

/**
 * Formatos soportados
 */
export type DiagramFormat = 'json' | 'zip';

/**
 * Error de detección de formato
 */
export class FormatDetectionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'FormatDetectionError';
  }
}

export class FormatDetector {
  /**
   * Detecta el formato del archivo
   * 
   * @param file - Archivo a analizar
   * @returns Promise<DiagramFormat> - Formato detectado ('json' | 'zip')
   * @throws FormatDetectionError si el formato no es soportado
   * 
   * @example
   * ```typescript
   * const detector = new FormatDetector();
   * const format = await detector.detect(file);
   * if (format === 'json') {
   *   // Procesar como JSON
   * } else {
   *   // Procesar como ZIP
   * }
   * ```
   */
  async detect(file: File | Blob): Promise<DiagramFormat> {
    try {
      // Leer primeros 4 bytes
      const header = await this.readHeader(file, 4);
      
      // ZIP magic number: 0x50 0x4B 0x03 0x04 (PK..)
      // Solo verificamos los primeros 2 bytes (PK) para mayor compatibilidad
      if (header[0] === 0x50 && header[1] === 0x4B) {
        return 'zip';
      }
      
      // JSON: empieza con '{'
      if (header[0] === 0x7B) { // 0x7B = '{'
        return 'json';
      }
      
      // Formato no reconocido
      throw new FormatDetectionError(
        `Unsupported file format. Expected JSON or ZIP.\n` +
        `File header: [${Array.from(header).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]`
      );
    } catch (error) {
      if (error instanceof FormatDetectionError) {
        throw error;
      }
      throw new FormatDetectionError(
        'Failed to detect file format',
        error
      );
    }
  }

  /**
   * Lee los primeros N bytes de un archivo
   * 
   * @param file - Archivo a leer
   * @param bytes - Número de bytes a leer
   * @returns Promise<Uint8Array> - Bytes leídos
   */
  private async readHeader(file: File | Blob, bytes: number): Promise<Uint8Array> {
    try {
      const slice = file.slice(0, bytes);
      const buffer = await slice.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (error) {
      throw new FormatDetectionError(
        'Failed to read file header',
        error
      );
    }
  }

  /**
   * Detecta el formato y retorna información adicional
   * 
   * Útil para debugging y logging
   * 
   * @param file - Archivo a analizar
   * @returns Promise<DetectedFormatInfo> - Información del formato detectado
   */
  async detectWithInfo(file: File | Blob): Promise<DetectedFormatInfo> {
    const header = await this.readHeader(file, 4);
    const format = await this.detect(file);
    
    return {
      format,
      fileSize: file.size,
      fileName: file instanceof File ? file.name : 'blob',
      header: Array.from(header),
      headerHex: Array.from(header).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
    };
  }
}

/**
 * Información detallada del formato detectado
 */
export interface DetectedFormatInfo {
  format: DiagramFormat;
  fileSize: number;
  fileName: string;
  header: number[];
  headerHex: string;
}
