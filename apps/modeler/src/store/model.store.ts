import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { withUndo } from '../core/undo/undoBridge';
import type {
  SemanticModel,
  IRClass,
  IRInterface,
  IREnum,
  IRActor,
  IRUseCase,
  IRSystemBoundary,
  IRUCModule,
  IRRelation,
  IRAttribute,
  IROperation,
  IRDomainEntity,
  IRDomainAttribute,
  IRLifeline,
  IRMessage,
} from '../core/domain/vfs/vfs.types';
import { getPackageHierarchy } from '../utils/packageHelpers';

function normalize(m: SemanticModel): SemanticModel {
  m.enums           = m.enums           ?? {};
  m.dataTypes       = m.dataTypes       ?? {};
  m.actors          = m.actors          ?? {};
  m.useCases        = m.useCases        ?? {};
  m.activityNodes   = m.activityNodes   ?? {};
  m.objectInstances = m.objectInstances ?? {};
  m.components      = m.components      ?? {};
  m.nodes           = m.nodes           ?? {};
  m.artifacts       = m.artifacts       ?? {};
  m.packageNames    = m.packageNames    ?? [];
  m.lifelines       = m.lifelines       ?? {};
  m.messages        = m.messages        ?? {};
  if (m.domainEntities  !== undefined) m.domainEntities  = m.domainEntities  ?? {};
  if (m.domainAttributes !== undefined) m.domainAttributes = m.domainAttributes ?? {};
  return m;
}

function cascadeDeleteMessages(model: SemanticModel, lifelineId: string) {
  if (!model.messages) return;
  Object.keys(model.messages).forEach((mid) => {
    const msg = model.messages![mid];
    if (msg.sourceLifelineId === lifelineId || msg.targetLifelineId === lifelineId) {
      delete model.messages![mid];
    }
  });
}

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

  updateActor: (id: string, patch: Partial<IRActor>) => void;
  updateUseCase: (id: string, patch: Partial<IRUseCase>) => void;
  updateSystemBoundary: (id: string, patch: Partial<IRSystemBoundary>) => void;
  updateUCModule: (id: string, patch: Partial<IRUCModule>) => void;

  createDomainEntity: (data: Omit<IRDomainEntity, 'id' | 'kind'>) => string;
  updateDomainEntity: (id: string, patch: Partial<IRDomainEntity>) => void;
  setDomainEntityAttributes: (id: string, attributes: IRDomainAttribute[]) => void;
  deleteDomainEntity: (id: string) => void;

  setElementMembers: (elementId: string, attributes: IRAttribute[], operations: IROperation[]) => void;

  createLifeline: (data: Omit<IRLifeline, 'id' | 'kind'>) => string;
  updateLifeline: (id: string, patch: Partial<IRLifeline>) => void;
  deleteLifeline: (id: string) => void;

  createMessage: (data: Omit<IRMessage, 'id' | 'kind'>) => string;
  updateMessage: (id: string, patch: Partial<IRMessage>) => void;
  deleteMessage: (id: string) => void;

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

export type ModelStore = ModelStoreState;

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
          lifelines: {},
          messages: {},
          relations: {},
          packageNames: [],
          createdAt: now,
          updatedAt: now,
        };
      }),

    loadModel: (model) =>
      set((state) => {
        state.model = normalize(model);
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
        
        draft.model.interfaces[id] = { ...data, id, kind: 'INTERFACE', attributeIds: data.attributeIds ?? [] };
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

    updateActor: (id, patch) => {
      const name = useModelStore.getState().model?.actors?.[id]?.name ?? id;
      withUndo('model', `Rename Actor: ${name}`, 'global', (draft) => {
        if (!draft.model?.actors?.[id]) return;
        draft.model.actors[id] = { ...draft.model.actors[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    updateUseCase: (id, patch) => {
      const name = useModelStore.getState().model?.useCases?.[id]?.name ?? id;
      withUndo('model', `Rename UseCase: ${name}`, 'global', (draft) => {
        if (!draft.model?.useCases?.[id]) return;
        draft.model.useCases[id] = { ...draft.model.useCases[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    updateSystemBoundary: (id, patch) => {
      const name = useModelStore.getState().model?.systemBoundaries?.[id]?.name ?? id;
      withUndo('model', `Rename System: ${name}`, 'global', (draft) => {
        if (!draft.model?.systemBoundaries?.[id]) return;
        draft.model.systemBoundaries![id] = { ...draft.model.systemBoundaries![id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    updateUCModule: (id, patch) => {
      const name = useModelStore.getState().model?.ucModules?.[id]?.name ?? id;
      withUndo('model', `Rename Module: ${name}`, 'global', (draft) => {
        if (!draft.model?.ucModules?.[id]) return;
        draft.model.ucModules![id] = { ...draft.model.ucModules![id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    createDomainEntity: (data) => {
      const id = newId();
      withUndo('model', `Create Entity: ${data.name}`, 'global', (draft) => {
        if (!draft.model) return;
        draft.model.domainEntities = draft.model.domainEntities ?? {};
        draft.model.domainAttributes = draft.model.domainAttributes ?? {};
        draft.model.domainEntities[id] = { ...data, id, kind: 'DOMAIN_ENTITY' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateDomainEntity: (id, patch) => {
      const name = useModelStore.getState().model?.domainEntities?.[id]?.name ?? id;
      withUndo('model', `Update Entity: ${name}`, 'global', (draft) => {
        if (!draft.model?.domainEntities?.[id]) return;
        draft.model.domainEntities[id] = { ...draft.model.domainEntities[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    setDomainEntityAttributes: (id, attributes) => {
      const name = useModelStore.getState().model?.domainEntities?.[id]?.name ?? id;
      withUndo('model', `Update Attributes: ${name}`, 'global', (draft) => {
        if (!draft.model?.domainEntities?.[id]) return;
        draft.model.domainAttributes = draft.model.domainAttributes ?? {};
        const entity = draft.model.domainEntities[id];
        entity.attributeIds.forEach((aid: string) => { delete draft.model.domainAttributes![aid]; });
        attributes.forEach((a) => { draft.model.domainAttributes![a.id] = a; });
        entity.attributeIds = attributes.map((a) => a.id);
        draft.model.updatedAt = Date.now();
      });
    },

    deleteDomainEntity: (id) => {
      const name = useModelStore.getState().model?.domainEntities?.[id]?.name ?? id;
      withUndo('model', `Delete Entity: ${name}`, 'global', (draft) => {
        if (!draft.model) return;
        draft.model.domainAttributes = draft.model.domainAttributes ?? {};
        const entity = draft.model.domainEntities?.[id];
        if (entity) {
          entity.attributeIds.forEach((aid: string) => { delete draft.model.domainAttributes![aid]; });
          delete draft.model.domainEntities![id];
        }
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
          (iface.attributeIds ?? []).forEach((id: string) => { delete draft.model.attributes[id]; });
          iface.operationIds.forEach((id: string) => { delete draft.model.operations[id]; });
          attributes.forEach((a: IRAttribute) => { draft.model.attributes[a.id] = a; });
          operations.forEach((o: IROperation) => { draft.model.operations[o.id] = o; });
          draft.model.interfaces[elementId].attributeIds = attributes.map((a: IRAttribute) => a.id);
          draft.model.interfaces[elementId].operationIds = operations.map((o: IROperation) => o.id);
        }
        draft.model.updatedAt = Date.now();
      });
    },

    createLifeline: (data) => {
      const id = newId();
      withUndo('model', `Create Lifeline: ${data.name}`, 'global', (draft) => {
        if (!draft.model) return;
        draft.model.lifelines = draft.model.lifelines ?? {};
        draft.model.lifelines[id] = { ...data, id, kind: 'LIFELINE' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateLifeline: (id, patch) => {
      const name = useModelStore.getState().model?.lifelines?.[id]?.name ?? id;
      withUndo('model', `Update Lifeline: ${name}`, 'global', (draft) => {
        if (!draft.model?.lifelines?.[id]) return;
        draft.model.lifelines[id] = { ...draft.model.lifelines[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteLifeline: (id) => {
      const name = useModelStore.getState().model?.lifelines?.[id]?.name ?? id;
      withUndo('model', `Delete Lifeline: ${name}`, 'global', (draft) => {
        if (!draft.model?.lifelines?.[id]) return;
        delete draft.model.lifelines[id];
        cascadeDeleteMessages(draft.model, id);
        draft.model.updatedAt = Date.now();
      });
    },

    createMessage: (data) => {
      const id = newId();
      withUndo('model', `Create Message: ${data.name || data.messageKind}`, 'global', (draft) => {
        if (!draft.model) return;
        draft.model.messages = draft.model.messages ?? {};
        draft.model.messages[id] = { ...data, id, kind: 'MESSAGE' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateMessage: (id, patch) => {
      const name = useModelStore.getState().model?.messages?.[id]?.name ?? id;
      withUndo('model', `Update Message: ${name}`, 'global', (draft) => {
        if (!draft.model?.messages?.[id]) return;
        draft.model.messages[id] = { ...draft.model.messages[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteMessage: (id) => {
      const name = useModelStore.getState().model?.messages?.[id]?.name ?? id;
      withUndo('model', `Delete Message: ${name}`, 'global', (draft) => {
        if (!draft.model?.messages?.[id]) return;
        delete draft.model.messages[id];
        // Cascade: REPLY messages that reference this one.
        Object.keys(draft.model.messages).forEach((mid) => {
          if (draft.model.messages![mid].inReplyTo === id) {
            delete draft.model.messages![mid];
          }
        });
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
  }))
);
