import type { DiagramState } from "../../../types/diagram.types";

/**
 * Persistence Service Contract
 * This interface decouples the UI from the storage implementation.
 */
export interface PersistenceService {
  save(state: DiagramState): Promise<void>;
  load(id: string): Promise<DiagramState | null>;
}

/**
 * LocalStorage Implementation (Current simple version)
 * We can replace this later with an Electron FileSystem implementation
 * or an API call without changing the components.
 */
export const LocalPersistence: PersistenceService = {
  async save(state: DiagramState): Promise<void> {
    try {
      // Usamos una clave única por diagrama
      localStorage.setItem(`diagram_${state.id}`, JSON.stringify(state));
      console.log(`[Persistence] Saved locally: ${state.name}`);
    } catch (error) {
      console.error("Error saving to local storage", error);
    }
  },

  async load(id: string): Promise<DiagramState | null> {
    const data = localStorage.getItem(`diagram_${id}`);
    return data ? JSON.parse(data) : null;
  }
};