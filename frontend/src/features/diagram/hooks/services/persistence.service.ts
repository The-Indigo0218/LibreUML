import type { DiagramState } from "../../../../types/diagram.types";

export interface PersistenceService {
  save(state: DiagramState): Promise<void>;
  load(id: string): Promise<DiagramState | null>;
}


export const LocalPersistence: PersistenceService = {
  async save(state: DiagramState): Promise<void> {
    try {
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