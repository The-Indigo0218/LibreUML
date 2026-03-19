import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  SemanticModel,
  IRClass,
  IRInterface,
  IREnum,
  IRRelation,
  IRAttribute,
  IROperation,
} from '../core/domain/vfs/vfs.types';
import { storageAdapter } from '../adapters/storage/storage.adapter';

const newId = () => crypto.randomUUID();

/** Cascade-delete all relations that reference a given element ID. */
function cascadeDeleteRelations(model: SemanticModel, elementId: string) {
  Object.keys(model.relations).forEach((relationId) => {
    const rel = model.relations[relationId];
    if (rel.sourceId === elementId || rel.targetId === elementId) {
      delete model.relations[relationId];
    }
  });
}

interface ModelStoreState {
  model: SemanticModel | null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  initModel: (domainModelId: string) => void;
  loadModel: (model: SemanticModel) => void;

  // ── Class CRUD ─────────────────────────────────────────────────────────────
  createClass: (data: Omit<IRClass, 'id' | 'kind'>) => string;
  /** Convenience helper: same as createClass but always sets isAbstract: true. */
  createAbstractClass: (data: Omit<IRClass, 'id' | 'kind' | 'isAbstract'>) => string;
  updateClass: (id: string, patch: Partial<IRClass>) => void;
  deleteClass: (id: string) => void;

  // ── Interface CRUD ─────────────────────────────────────────────────────────
  createInterface: (data: Omit<IRInterface, 'id' | 'kind'>) => string;
  updateInterface: (id: string, patch: Partial<IRInterface>) => void;
  deleteInterface: (id: string) => void;

  // ── Enum CRUD ──────────────────────────────────────────────────────────────
  createEnum: (data: Omit<IREnum, 'id' | 'kind'>) => string;
  updateEnum: (id: string, patch: Partial<IREnum>) => void;
  deleteEnum: (id: string) => void;

  // ── Member management ──────────────────────────────────────────────────────
  setElementMembers: (elementId: string, attributes: IRAttribute[], operations: IROperation[]) => void;

  // ── Relation CRUD ──────────────────────────────────────────────────────────
  createRelation: (data: Omit<IRRelation, 'id'>) => string;
  updateRelation: (id: string, patch: Partial<Omit<IRRelation, 'id'>>) => void;
  deleteRelation: (id: string) => void;

  // ── External integration ───────────────────────────────────────────────────
  integrateExternalElement: (elementId: string) => void;
  /** Sets isExternal: true on an element so it is hidden from the ModelExplorer. */
  untrackElement: (elementId: string) => void;
  /** Clears the entire model (used when a project is closed). */
  resetModel: () => void;
}

export const useModelStore = create<ModelStoreState>()(
  persist(
    immer((set) => ({
    model: null,

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    initModel: (domainModelId) =>
      set((state) => {
        const now = Date.now();
        state.model = {
          id: domainModelId,
          name: 'Domain Model',
          version: '1.0.0',
          packages: {},
          classes: {},
          interfaces: {},
          enums: {},
          dataTypes: {},
          attributes: {},
          operations: {},
          actors: {},
          useCases: {},
          activityNodes: {},
          objectInstances: {},
          components: {},
          nodes: {},
          artifacts: {},
          relations: {},
          createdAt: now,
          updatedAt: now,
        };
      }),

    loadModel: (model) =>
      set((state) => {
        state.model = model;
      }),

    // ── Class ─────────────────────────────────────────────────────────────────

    createClass: (data) => {
      const id = newId();
      set((state) => {
        if (!state.model) return;
        state.model.classes[id] = { ...data, id, kind: 'CLASS' };
        state.model.updatedAt = Date.now();
      });
      return id;
    },

    createAbstractClass: (data) => {
      const id = newId();
      set((state) => {
        if (!state.model) return;
        state.model.classes[id] = { ...data, id, kind: 'CLASS', isAbstract: true };
        state.model.updatedAt = Date.now();
      });
      return id;
    },

    updateClass: (id, patch) =>
      set((state) => {
        if (!state.model || !state.model.classes[id]) return;
        state.model.classes[id] = { ...state.model.classes[id], ...patch };
        state.model.updatedAt = Date.now();
      }),

    deleteClass: (id) =>
      set((state) => {
        if (!state.model) return;
        delete state.model.classes[id];
        cascadeDeleteRelations(state.model, id);
        state.model.updatedAt = Date.now();
      }),

    // ── Interface ─────────────────────────────────────────────────────────────

    createInterface: (data) => {
      const id = newId();
      set((state) => {
        if (!state.model) return;
        state.model.interfaces[id] = { ...data, id, kind: 'INTERFACE' };
        state.model.updatedAt = Date.now();
      });
      return id;
    },

    updateInterface: (id, patch) =>
      set((state) => {
        if (!state.model || !state.model.interfaces[id]) return;
        state.model.interfaces[id] = { ...state.model.interfaces[id], ...patch };
        state.model.updatedAt = Date.now();
      }),

    deleteInterface: (id) =>
      set((state) => {
        if (!state.model) return;
        delete state.model.interfaces[id];
        cascadeDeleteRelations(state.model, id);
        state.model.updatedAt = Date.now();
      }),

    // ── Enum ──────────────────────────────────────────────────────────────────

    createEnum: (data) => {
      const id = newId();
      set((state) => {
        if (!state.model) return;
        state.model.enums[id] = { ...data, id, kind: 'ENUM' };
        state.model.updatedAt = Date.now();
      });
      return id;
    },

    updateEnum: (id, patch) =>
      set((state) => {
        if (!state.model || !state.model.enums[id]) return;
        state.model.enums[id] = { ...state.model.enums[id], ...patch };
        state.model.updatedAt = Date.now();
      }),

    deleteEnum: (id) =>
      set((state) => {
        if (!state.model) return;
        delete state.model.enums[id];
        cascadeDeleteRelations(state.model, id);
        state.model.updatedAt = Date.now();
      }),

    // ── Member management ─────────────────────────────────────────────────────

    setElementMembers: (elementId, attributes, operations) =>
      set((state) => {
        if (!state.model) return;
        const cls = state.model.classes[elementId];
        const iface = state.model.interfaces[elementId];
        if (cls) {
          cls.attributeIds.forEach((id) => { delete state.model!.attributes[id]; });
          cls.operationIds.forEach((id) => { delete state.model!.operations[id]; });
          attributes.forEach((a) => { state.model!.attributes[a.id] = a; });
          operations.forEach((o) => { state.model!.operations[o.id] = o; });
          state.model.classes[elementId].attributeIds = attributes.map((a) => a.id);
          state.model.classes[elementId].operationIds = operations.map((o) => o.id);
        } else if (iface) {
          iface.operationIds.forEach((id) => { delete state.model!.operations[id]; });
          operations.forEach((o) => { state.model!.operations[o.id] = o; });
          state.model.interfaces[elementId].operationIds = operations.map((o) => o.id);
        }
        state.model.updatedAt = Date.now();
      }),

    // ── Relations ─────────────────────────────────────────────────────────────

    createRelation: (data) => {
      const id = newId();
      set((state) => {
        if (!state.model) return;
        state.model.relations[id] = { ...data, id };
        state.model.updatedAt = Date.now();
      });
      return id;
    },

    updateRelation: (id, patch) =>
      set((state) => {
        if (!state.model || !state.model.relations[id]) return;
        state.model.relations[id] = { ...state.model.relations[id], ...patch };
        state.model.updatedAt = Date.now();
      }),

    deleteRelation: (id) =>
      set((state) => {
        if (!state.model) return;
        delete state.model.relations[id];
        state.model.updatedAt = Date.now();
      }),

    integrateExternalElement: (elementId) =>
      set((state) => {
        if (!state.model) return;
        const cls = state.model.classes[elementId];
        const iface = state.model.interfaces[elementId];
        const enm = state.model.enums[elementId];
        if (cls) {
          state.model.classes[elementId].isExternal = undefined;
        } else if (iface) {
          state.model.interfaces[elementId].isExternal = undefined;
        } else if (enm) {
          state.model.enums[elementId].isExternal = undefined;
        } else {
          return;
        }
        for (const rel of Object.values(state.model.relations)) {
          if (rel.sourceId === elementId || rel.targetId === elementId) {
            state.model.relations[rel.id].isExternal = undefined;
          }
        }
        state.model.updatedAt = Date.now();
      }),

    untrackElement: (elementId) =>
      set((state) => {
        if (!state.model) return;
        const cls = state.model.classes[elementId];
        const iface = state.model.interfaces[elementId];
        const enm = state.model.enums[elementId];
        if (cls) {
          state.model.classes[elementId].isExternal = true;
        } else if (iface) {
          state.model.interfaces[elementId].isExternal = true;
        } else if (enm) {
          state.model.enums[elementId].isExternal = true;
        } else {
          return;
        }
        state.model.updatedAt = Date.now();
      }),

    resetModel: () =>
      set((state) => {
        state.model = null;
      }),
  })),
  {
    name: 'libreuml-model-storage',
    // Persist only the model data — actions are reconstructed from the store definition.
    partialize: (state) => ({ model: state.model }),
    storage: {
      getItem: (name) => {
        const value = storageAdapter.getItem(name);
        return value ? JSON.parse(value) : null;
      },
      setItem: (name, value) => {
        storageAdapter.setItem(name, JSON.stringify(value));
      },
      removeItem: (name) => {
        storageAdapter.removeItem(name);
      },
    },
  }
  )
);
