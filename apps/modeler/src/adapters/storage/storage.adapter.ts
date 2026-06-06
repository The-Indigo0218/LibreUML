export interface StorageAdapter {

  getItem(key: string): string | null;


  setItem(key: string, value: string): void;


  removeItem(key: string): void;


  clear?(): void;


  getAllKeys?(): string[];
}

export function createStorageAdapter(): StorageAdapter {
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron()) {
    return new ElectronStorageAdapter();
  }
  return new WebStorageAdapter();
}


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


export class ElectronStorageAdapter implements StorageAdapter {
  private cache: Map<string, string> = new Map();
  private initialized = false;

  constructor() {
    this.initializeCache();
  }

  private async initializeCache(): Promise<void> {
    if (this.initialized) return;

    try {

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
      if (this.cache.has(key)) {
        return this.cache.get(key) || null;
      }

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
      this.cache.set(key, value);

      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
      }

      // TODO: Add Electron file system persistence
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

      // TODO: Add Electron file system deletion
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

      // TODO: Add Electron file system clear
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


export const storageAdapter = createStorageAdapter();
