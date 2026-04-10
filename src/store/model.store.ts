import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { withUndo } from '../core/undo/undoBridge';
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
import { getPackageHierarchy } from '../utils/packageHelpers';

const newId = () => crypto.randomUUID();

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

  initModel: (domainModelId: string) => void;
  loadModel: (model: SemanticModel) => void;

  createClass: (data: Omit<IRClass, 'id' | 'kind'>) => string;
  createAbstractClass: (data: Omit<IRClass, 'id' | 'kind' | 'isAbstract'>) => string;
  updateClass: (id: string, patch: Partial<IRClass>) => void;
  deleteClass: (id: string) => void;

  createInterface: (data: Omit<IRInterface, 'id' | 'kind'>) => string;
  updateInterface: (id: string, patch: Partial<IRInterface>) => void;
  deleteInterface: (id: string) => void;

  createEnum: (data: Omit<IREnum, 'id' | 'kind'>) => string;
  updateEnum: (id: string, patch: Partial<IREnum>) => void;
  deleteEnum: (id: string) => void;

  setElementMembers: (elementId: string, attributes: IRAttribute[], operations: IROperation[]) => void;

  createRelation: (data: Omit<IRRelation, 'id'>) => string;
  updateRelation: (id: string, patch: Partial<Omit<IRRelation, 'id'>>) => void;
  deleteRelation: (id: string) => void;

  integrateExternalElement: (elementId: string) => void;
  untrackElement: (elementId: string) => void;
  resetModel: () => void;

  addPackageName: (name: string) => void;
  removePackageName: (name: string) => void;
  setElementPackage: (elementId: string, packageName: string | undefined) => void;
}

export const useModelStore = create<ModelStoreState>()(
  persist(
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
          packageNames: [],
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
      withUndo('model', `Create Class: ${data.name}`, 'global', (draft) => {
        if (!draft.model) return;
        
        // Auto-create intermediate packages if packageName contains dots
        if (data.packageName) {
          const hierarchy = getPackageHierarchy(data.packageName);
          if (!draft.model.packageNames) draft.model.packageNames = [];
          hierarchy.forEach(pkg => {
            if (!draft.model.packageNames.includes(pkg)) {
              draft.model.packageNames.push(pkg);
            }
          });
        }
        
        draft.model.classes[id] = { ...data, id, kind: 'CLASS' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    createAbstractClass: (data) => {
      const id = newId();
      withUndo('model', `Create Abstract Class: ${data.name}`, 'global', (draft) => {
        if (!draft.model) return;
        
        // Auto-create intermediate packages if packageName contains dots
        if (data.packageName) {
          const hierarchy = getPackageHierarchy(data.packageName);
          if (!draft.model.packageNames) draft.model.packageNames = [];
          hierarchy.forEach(pkg => {
            if (!draft.model.packageNames.includes(pkg)) {
              draft.model.packageNames.push(pkg);
            }
          });
        }
        
        draft.model.classes[id] = { ...data, id, kind: 'CLASS', isAbstract: true };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateClass: (id, patch) => {
      const name = useModelStore.getState().model?.classes[id]?.name ?? id;
      withUndo('model', `Update Class: ${name}`, 'global', (draft) => {
        if (!draft.model || !draft.model.classes[id]) return;
        draft.model.classes[id] = { ...draft.model.classes[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteClass: (id) => {
      const name = useModelStore.getState().model?.classes[id]?.name ?? id;
      withUndo('model', `Delete Class: ${name}`, 'global', (draft) => {
        if (!draft.model) return;
        delete draft.model.classes[id];
        cascadeDeleteRelations(draft.model, id);
        draft.model.updatedAt = Date.now();
      });
    },

    createInterface: (data) => {
      const id = newId();
      withUndo('model', `Create Interface: ${data.name}`, 'global', (draft) => {
        if (!draft.model) return;
        
        // Auto-create intermediate packages if packageName contains dots
        if (data.packageName) {
          const hierarchy = getPackageHierarchy(data.packageName);
          if (!draft.model.packageNames) draft.model.packageNames = [];
          hierarchy.forEach(pkg => {
            if (!draft.model.packageNames.includes(pkg)) {
              draft.model.packageNames.push(pkg);
            }
          });
        }
        
        draft.model.interfaces[id] = { ...data, id, kind: 'INTERFACE' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateInterface: (id, patch) => {
      const name = useModelStore.getState().model?.interfaces[id]?.name ?? id;
      withUndo('model', `Update Interface: ${name}`, 'global', (draft) => {
        if (!draft.model || !draft.model.interfaces[id]) return;
        draft.model.interfaces[id] = { ...draft.model.interfaces[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteInterface: (id) => {
      const name = useModelStore.getState().model?.interfaces[id]?.name ?? id;
      withUndo('model', `Delete Interface: ${name}`, 'global', (draft) => {
        if (!draft.model) return;
        delete draft.model.interfaces[id];
        cascadeDeleteRelations(draft.model, id);
        draft.model.updatedAt = Date.now();
      });
    },

    createEnum: (data) => {
      const id = newId();
      withUndo('model', `Create Enum: ${data.name}`, 'global', (draft) => {
        if (!draft.model) return;
        
        // Auto-create intermediate packages if packageName contains dots
        if (data.packageName) {
          const hierarchy = getPackageHierarchy(data.packageName);
          if (!draft.model.packageNames) draft.model.packageNames = [];
          hierarchy.forEach(pkg => {
            if (!draft.model.packageNames.includes(pkg)) {
              draft.model.packageNames.push(pkg);
            }
          });
        }
        
        draft.model.enums[id] = { ...data, id, kind: 'ENUM' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateEnum: (id, patch) => {
      const name = useModelStore.getState().model?.enums[id]?.name ?? id;
      withUndo('model', `Update Enum: ${name}`, 'global', (draft) => {
        if (!draft.model || !draft.model.enums[id]) return;
        draft.model.enums[id] = { ...draft.model.enums[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteEnum: (id) => {
      const name = useModelStore.getState().model?.enums[id]?.name ?? id;
      withUndo('model', `Delete Enum: ${name}`, 'global', (draft) => {
        if (!draft.model) return;
        delete draft.model.enums[id];
        cascadeDeleteRelations(draft.model, id);
        draft.model.updatedAt = Date.now();
      });
    },

    setElementMembers: (elementId, attributes, operations) => {
      const m = useModelStore.getState().model;
      const name = m?.classes[elementId]?.name ?? m?.interfaces[elementId]?.name ?? elementId;
      withUndo('model', `Update Members: ${name}`, 'global', (draft) => {
        if (!draft.model) return;
        const cls = draft.model.classes[elementId];
        const iface = draft.model.interfaces[elementId];
        if (cls) {
          cls.attributeIds.forEach((id: string) => { delete draft.model.attributes[id]; });
          cls.operationIds.forEach((id: string) => { delete draft.model.operations[id]; });
          attributes.forEach((a: IRAttribute) => { draft.model.attributes[a.id] = a; });
          operations.forEach((o: IROperation) => { draft.model.operations[o.id] = o; });
          draft.model.classes[elementId].attributeIds = attributes.map((a: IRAttribute) => a.id);
          draft.model.classes[elementId].operationIds = operations.map((o: IROperation) => o.id);
        } else if (iface) {
          iface.operationIds.forEach((id: string) => { delete draft.model.operations[id]; });
          operations.forEach((o: IROperation) => { draft.model.operations[o.id] = o; });
          draft.model.interfaces[elementId].operationIds = operations.map((o: IROperation) => o.id);
        }
        draft.model.updatedAt = Date.now();
      });
    },

    createRelation: (data) => {
      const id = newId();
      withUndo('model', `Create Relation: ${data.kind}`, 'global', (draft) => {
        if (!draft.model) return;
        draft.model.relations[id] = { ...data, id };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateRelation: (id, patch) => {
      const rel = useModelStore.getState().model?.relations[id];
      const label = rel ? `Update Relation: ${rel.kind}` : 'Update Relation';
      withUndo('model', label, 'global', (draft) => {
        if (!draft.model || !draft.model.relations[id]) return;
        draft.model.relations[id] = { ...draft.model.relations[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteRelation: (id) => {
      const rel = useModelStore.getState().model?.relations[id];
      const label = rel ? `Delete Relation: ${rel.kind}` : 'Delete Relation';
      withUndo('model', label, 'global', (draft) => {
        if (!draft.model) return;
        delete draft.model.relations[id];
        draft.model.updatedAt = Date.now();
      });
    },

    integrateExternalElement: (elementId) =>
      withUndo('model', 'Integrate External Element', 'global', (draft) => {
        if (!draft.model) return;
        const cls = draft.model.classes[elementId];
        const iface = draft.model.interfaces[elementId];
        const enm = draft.model.enums[elementId];
        if (cls) {
          draft.model.classes[elementId].isExternal = undefined;
        } else if (iface) {
          draft.model.interfaces[elementId].isExternal = undefined;
        } else if (enm) {
          draft.model.enums[elementId].isExternal = undefined;
        } else {
          return;
        }
        for (const rel of Object.values(draft.model.relations) as IRRelation[]) {
          if (rel.sourceId === elementId || rel.targetId === elementId) {
            draft.model.relations[rel.id].isExternal = undefined;
          }
        }
        draft.model.updatedAt = Date.now();
      }),

    untrackElement: (elementId) =>
      withUndo('model', 'Untrack Element', 'global', (draft) => {
        if (!draft.model) return;
        const cls = draft.model.classes[elementId];
        const iface = draft.model.interfaces[elementId];
        const enm = draft.model.enums[elementId];
        if (cls) {
          draft.model.classes[elementId].isExternal = true;
        } else if (iface) {
          draft.model.interfaces[elementId].isExternal = true;
        } else if (enm) {
          draft.model.enums[elementId].isExternal = true;
        } else {
          return;
        }
        draft.model.updatedAt = Date.now();
      }),

    resetModel: () =>
      set((state) => {
        state.model = null;
      }),

    addPackageName: (name) =>
      withUndo('model', `Add Package: ${name}`, 'global', (draft) => {
        if (!draft.model) return;
        if (!draft.model.packageNames) draft.model.packageNames = [];
        if (!draft.model.packageNames.includes(name)) {
          draft.model.packageNames.push(name);
          draft.model.updatedAt = Date.now();
        }
      }),

    removePackageName: (name) =>
      withUndo('model', `Remove Package: ${name}`, 'global', (draft) => {
        if (!draft.model || !draft.model.packageNames) return;
        draft.model.packageNames = draft.model.packageNames.filter((n: string) => n !== name);
        draft.model.updatedAt = Date.now();
      }),

    setElementPackage: (elementId, packageName) => {
      const m = useModelStore.getState().model;
      const elName = m?.classes[elementId]?.name ?? m?.interfaces[elementId]?.name ?? m?.enums[elementId]?.name ?? elementId;
      const dest = packageName ?? 'default';
      withUndo('model', `Move ${elName} to Package: ${dest}`, 'global', (draft) => {
        if (!draft.model) return;
        
        // Auto-create intermediate packages if packageName contains dots
        if (packageName) {
          const hierarchy = getPackageHierarchy(packageName);
          if (!draft.model.packageNames) draft.model.packageNames = [];
          hierarchy.forEach(pkg => {
            if (!draft.model.packageNames.includes(pkg)) {
              draft.model.packageNames.push(pkg);
            }
          });
        }
        
        if (draft.model.classes[elementId]) {
          draft.model.classes[elementId].packageName = packageName;
        } else if (draft.model.interfaces[elementId]) {
          draft.model.interfaces[elementId].packageName = packageName;
        } else if (draft.model.enums[elementId]) {
          draft.model.enums[elementId].packageName = packageName;
        } else return;
        draft.model.updatedAt = Date.now();
      });
    },
  })),
  {
    name: 'libreuml-model-storage',
    version: 1,
    migrate: (persistedState: unknown, version: number): { model: SemanticModel | null } => {
      const typed = persistedState as { model: SemanticModel | null };
      if (version < 1 && typed.model) {
        const m = typed.model;
        m.enums            = m.enums            ?? {};
        m.dataTypes        = m.dataTypes        ?? {};
        m.actors           = m.actors           ?? {};
        m.useCases         = m.useCases         ?? {};
        m.activityNodes    = m.activityNodes    ?? {};
        m.objectInstances  = m.objectInstances  ?? {};
        m.components       = m.components       ?? {};
        m.nodes            = m.nodes            ?? {};
        m.artifacts        = m.artifacts        ?? {};
        m.packageNames     = m.packageNames     ?? [];
      }
      return typed;
    },
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
    onRehydrateStorage: () => {
      return () => {
        setTimeout(() => {
          import('../core/undo/instance').then(({ undoManager }) => {
            undoManager.clear();
          });
        }, 0);
      };
    },
  }
  )
);
