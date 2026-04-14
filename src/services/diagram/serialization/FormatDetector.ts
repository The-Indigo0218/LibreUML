/**
 * FormatDetector.ts
 *
 * Detects the format of a .luml file automatically.
 *
 * Detection strategy:
 * 1. Read the first 4 bytes
 * 2. If starts with 'PK' (0x50 0x4B 0x03 0x04) → ZIP
 * 3. If starts with '{' (0x7B) → JSON
 * 4. Otherwise → Error
 */

export type DiagramFormat = 'json' | 'zip';

export class FormatDetectionError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'FormatDetectionError';
    this.cause = cause;
  }
}

export class FormatDetector {
  /**
   * Detects the file format (alias for detectFormat).
   */
  async detect(file: File | Blob): Promise<DiagramFormat> {
    return this.detectFormat(file);
  }

  /**
   * Detects the file format.
   *
   * @throws FormatDetectionError if the format is not supported
   */
  async detectFormat(file: File | Blob): Promise<DiagramFormat> {
    try {
      const header = await this.readHeader(file, 4);

      if (header[0] === 0x50 && header[1] === 0x4B) {
        return 'zip';
      }

      if (header[0] === 0x7B) {
        return 'json';
      }

      throw new FormatDetectionError(
        `Unsupported file format. Expected JSON or ZIP.\n` +
        `File header: [${Array.from(header).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]`
      );
    } catch (error) {
      if (error instanceof FormatDetectionError) {
        throw error;
      }
      throw new FormatDetectionError('Failed to detect file format', error);
    }
  }

  /**
   * Returns true only if the file starts with '{' AND is valid JSON.
   */
  async isJsonFormat(file: File | Blob): Promise<boolean> {
    try {
      const header = await this.readHeader(file, 1);
      if (header.length < 1 || header[0] !== 0x7B) return false;
      const text = await this.readAsText(file);
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }

  private readAsText(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file as text'));
      reader.readAsText(file);
    });
  }

  /**
   * Returns true only if the file has the ZIP magic number (all 4 bytes) and is at least 4 bytes.
   */
  async isZipFormat(file: File | Blob): Promise<boolean> {
    try {
      if (file.size < 4) return false;
      const header = await this.readHeader(file, 4);
      return (
        header[0] === 0x50 &&
        header[1] === 0x4B &&
        header[2] === 0x03 &&
        header[3] === 0x04
      );
    } catch {
      return false;
    }
  }

  /**
   * Detects the format and returns additional debug info.
   */
  async detectWithInfo(file: File | Blob): Promise<DetectedFormatInfo> {
    const header = await this.readHeader(file, 4);
    const format = await this.detectFormat(file);

    return {
      format,
      fileSize: file.size,
      fileName: file instanceof File ? file.name : 'blob',
      header: Array.from(header),
      headerHex: Array.from(header).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
    };
  }

  private readHeader(file: File | Blob, bytes: number): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      try {
        const slice = file.slice(0, bytes);
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(new Uint8Array(reader.result));
          } else {
            reject(new FormatDetectionError('Failed to read file header'));
          }
        };
        reader.onerror = () =>
          reject(new FormatDetectionError('Failed to read file header', reader.error));
        reader.readAsArrayBuffer(slice);
      } catch (error) {
        reject(new FormatDetectionError('Failed to read file header', error));
      }
    });
  }
}

export interface DetectedFormatInfo {
  format: DiagramFormat;
  fileSize: number;
  fileName: string;
  header: number[];
  headerHex: string;
}
