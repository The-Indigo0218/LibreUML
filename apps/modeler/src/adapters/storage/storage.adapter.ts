/**
 * Storage Adapter Interface
 * 
 * Abstracts storage operations to support both Web (localStorage/IndexedDB)
 * and Electron (native file system) environments.
 * 
 * This allows Zustand persist middleware and manual storage operations
 * to work seamlessly across platforms.
 * 
 * Note: Zustand persist requires synchronous operations, so all methods
 * return values directly (not Promises).
 */

export interface StorageAdapter {
  /**
   * Get an item from storage
   * @param key Storage key
   * @returns Stored value or null if not found
   */
  getItem(key: string): string | null;

  /**
   * Set an item in storage
   * @param key Storage key
   * @param value Value to store (will be stringified)
   */
  setItem(key: string, value: string): void;

  /**
   * Remove an item from storage
   * @param key Storage key
   */
  removeItem(key: string): void;

  /**
   * Clear all items from storage
   */
  clear?(): void;

  /**
   * Get all keys in storage
   */
  getAllKeys?(): string[];
}

/**
 * Storage Adapter Factory
 * 
 * Returns the appropriate storage adapter based on the environment:
 * - Electron: Uses native file system via electronAPI
 * - Web: Uses localStorage
 */
export function createStorageAdapter(): StorageAdapter {
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron()) {
    return new ElectronStorageAdapter();
  }
  return new WebStorageAdapter();
}

/**
 * Web Storage Adapter
 * 
 * Uses browser localStorage for persistence.
 * Synchronous operations, simple and fast.
 */
export class WebStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('[WebStorageAdapter] Error getting item:', error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('[WebStorageAdapter] Error setting item:', error);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('[WebStorageAdapter] Error removing item:', error);
    }
  }

  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('[WebStorageAdapter] Error clearing storage:', error);
    }
  }

  getAllKeys(): string[] {
    try {
      return Object.keys(localStorage);
    } catch (error) {
      console.error('[WebStorageAdapter] Error getting keys:', error);
      return [];
    }
  }
}

/**
 * Electron Storage Adapter
 * 
 * Uses Electron's native file system for persistence.
 * Stores data in app data directory as JSON files.
 * 
 * Note: Operations are synchronous wrappers around async Electron API.
 * Zustand persist middleware expects synchronous storage.
 */
export class ElectronStorageAdapter implements StorageAdapter {
  private cache: Map<string, string> = new Map();
  private initialized = false;

  constructor() {
    this.initializeCache();
  }

  /**
   * Initialize cache from Electron storage
   * This runs asynchronously but doesn't block construction
   */
  private async initializeCache(): Promise<void> {
    if (this.initialized) return;

    try {
      // For now, use localStorage as fallback until Electron storage API is ready
      // This will be replaced with proper Electron file system operations
      if (typeof window !== 'undefined' && window.localStorage) {
        const keys = Object.keys(localStorage);
        keys.forEach((key) => {
          const value = localStorage.getItem(key);
          if (value) {
            this.cache.set(key, value);
          }
        });
      }
      this.initialized = true;
    } catch (error) {
      console.error('[ElectronStorageAdapter] Error initializing cache:', error);
    }
  }

  getItem(key: string): string | null {
    try {
      // Return from cache if available
      if (this.cache.has(key)) {
        return this.cache.get(key) || null;
      }

      // Fallback to localStorage for immediate reads
      if (typeof window !== 'undefined' && window.localStorage) {
        const value = localStorage.getItem(key);
        if (value) {
          this.cache.set(key, value);
        }
        return value;
      }

      return null;
    } catch (error) {
      console.error('[ElectronStorageAdapter] Error getting item:', error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      // Update cache immediately
      this.cache.set(key, value);

      // Persist to localStorage (will be replaced with Electron API)
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
      }

      // TODO: Phase 5.1 - Add Electron file system persistence
      // this.persistToElectronFS(key, value);
    } catch (error) {
      console.error('[ElectronStorageAdapter] Error setting item:', error);
    }
  }

  removeItem(key: string): void {
    try {
      this.cache.delete(key);

      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }

      // TODO: Phase 5.1 - Add Electron file system deletion
      // this.deleteFromElectronFS(key);
    } catch (error) {
      console.error('[ElectronStorageAdapter] Error removing item:', error);
    }
  }

  clear(): void {
    try {
      this.cache.clear();

      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.clear();
      }

      // TODO: Phase 5.1 - Add Electron file system clear
      // this.clearElectronFS();
    } catch (error) {
      console.error('[ElectronStorageAdapter] Error clearing storage:', error);
    }
  }

  getAllKeys(): string[] {
    try {
      return Array.from(this.cache.keys());
    } catch (error) {
      console.error('[ElectronStorageAdapter] Error getting keys:', error);
      return [];
    }
  }
}

/**
 * Global storage adapter instance
 * Created once and reused throughout the application
 */
export const storageAdapter = createStorageAdapter();
