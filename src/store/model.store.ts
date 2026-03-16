import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { SemanticModel, IRClass, IRRelation } from '../core/domain/vfs/vfs.types';

const newId = () => crypto.randomUUID();

interface ModelStoreState {
  model: SemanticModel | null;
  initModel: (domainModelId: string) => void;
  loadModel: (model: SemanticModel) => void;
  createClass: (data: Omit<IRClass, 'id' | 'kind'>) => string;
  updateClass: (id: string, patch: Partial<IRClass>) => void;
  deleteClass: (id: string) => void;
  createRelation: (data: Omit<IRRelation, 'id'>) => string;
  deleteRelation: (id: string) => void;
}

export const useModelStore = create<ModelStoreState>()(
  immer((set) => ({
    model: null,

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

    createClass: (data) => {
      const id = newId();
      set((state) => {
        if (!state.model) return;
        state.model.classes[id] = {
          ...data,
          id,
          kind: 'CLASS',
        };
        state.model.updatedAt = Date.now();
      });
      return id;
    },

    updateClass: (id, patch) =>
      set((state) => {
        if (!state.model || !state.model.classes[id]) return;
        state.model.classes[id] = {
          ...state.model.classes[id],
          ...patch,
        };
        state.model.updatedAt = Date.now();
      }),

    deleteClass: (id) =>
      set((state) => {
        if (!state.model) return;
        delete state.model.classes[id];

        Object.keys(state.model.relations).forEach((relationId) => {
          const relation = state.model!.relations[relationId];
          if (relation.sourceId === id || relation.targetId === id) {
            delete state.model!.relations[relationId];
          }
        });

        state.model.updatedAt = Date.now();
      }),

    createRelation: (data) => {
      const id = newId();
      set((state) => {
        if (!state.model) return;
        state.model.relations[id] = {
          ...data,
          id,
        };
        state.model.updatedAt = Date.now();
      });
      return id;
    },

    deleteRelation: (id) =>
      set((state) => {
        if (!state.model) return;
        delete state.model.relations[id];
        state.model.updatedAt = Date.now();
      }),
  }))
);
