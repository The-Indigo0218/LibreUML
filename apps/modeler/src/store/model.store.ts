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
  IRActivation,
  IRInteractionFragment,
  IRStateInvariant,
  IRInteractionUse,
  IRGate,
  IRGeneralOrdering,
  IRTimeConstraint,
  IRCoregion,
  IRContinuation,
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
  m.lifelines           = m.lifelines           ?? {};
  m.messages            = m.messages            ?? {};
  m.activations         = m.activations         ?? {};
  m.interactionFragments = m.interactionFragments ?? {};
  m.stateInvariants     = m.stateInvariants     ?? {};
  m.interactionUses     = m.interactionUses     ?? {};
  m.gates               = m.gates               ?? {};
  if (m.domainEntities  !== undefined) m.domainEntities  = m.domainEntities  ?? {};
  if (m.domainAttributes !== undefined) m.domainAttributes = m.domainAttributes ?? {};
  return m;
}

function cascadeDeleteMessages(model: SemanticModel, lifelineId: string) {
  if (!model.messages) return;
  const removedMessageIds = new Set<string>();
  Object.keys(model.messages).forEach((mid) => {
    const msg = model.messages![mid];
    if (msg.sourceLifelineId === lifelineId || msg.targetLifelineId === lifelineId) {
      removedMessageIds.add(mid);
      delete model.messages![mid];
    }
  });
  // Cascade activations bound to those messages OR to the lifeline itself.
  if (model.activations) {
    Object.keys(model.activations).forEach((aid) => {
      const act = model.activations![aid];
      if (
        act.lifelineId === lifelineId ||
        removedMessageIds.has(act.startMessageId) ||
        (act.endMessageId && removedMessageIds.has(act.endMessageId))
      ) {
        delete model.activations![aid];
      }
    });
  }
  // Strip the lifeline from any fragment that covered it; drop empty fragments.
  if (model.interactionFragments) {
    Object.keys(model.interactionFragments).forEach((fid) => {
      const frag = model.interactionFragments![fid];
      frag.coveredLifelineIds = frag.coveredLifelineIds.filter((id) => id !== lifelineId);
      // Strip removed message ids from operands too.
      frag.operands.forEach((op) => {
        op.messageIds = op.messageIds.filter((mid) => !removedMessageIds.has(mid));
      });
      if (frag.coveredLifelineIds.length === 0) {
        removeGatesForFragment(model, fid);
        delete model.interactionFragments![fid];
      }
    });
  }
  // State invariants attached to the removed lifeline go with it.
  if (model.stateInvariants) {
    Object.keys(model.stateInvariants).forEach((sid) => {
      if (model.stateInvariants![sid].lifelineId === lifelineId) {
        delete model.stateInvariants![sid];
      }
    });
  }
  // Coregions bracket a single lifeline → drop with it.
  if (model.coregions) {
    Object.keys(model.coregions).forEach((cid) => {
      if (model.coregions![cid].lifelineId === lifelineId) {
        delete model.coregions![cid];
      }
    });
  }
  // Continuations span lifelines too → strip, drop if it covered none else.
  if (model.continuations) {
    Object.keys(model.continuations).forEach((cid) => {
      const cont = model.continuations![cid];
      cont.coveredLifelineIds = cont.coveredLifelineIds.filter((id) => id !== lifelineId);
      if (cont.coveredLifelineIds.length === 0) {
        delete model.continuations![cid];
      }
    });
  }
  // Strip the lifeline from any interaction-use; drop the ref if it covered none else.
  if (model.interactionUses) {
    Object.keys(model.interactionUses).forEach((uid) => {
      const use = model.interactionUses![uid];
      use.coveredLifelineIds = use.coveredLifelineIds.filter((id) => id !== lifelineId);
      if (use.coveredLifelineIds.length === 0) {
        delete model.interactionUses![uid];
      }
    });
  }
}

function cascadeDeleteActivationsForMessage(model: SemanticModel, messageId: string) {
  if (!model.activations) return;
  Object.keys(model.activations).forEach((aid) => {
    const act = model.activations![aid];
    if (act.startMessageId === messageId) {
      delete model.activations![aid];
    } else if (act.endMessageId === messageId) {
      // Just clear the end so the activation stays open until something else closes it.
      delete (model.activations![aid] as { endMessageId?: string }).endMessageId;
    }
  });
}

function stripMessageFromFragments(model: SemanticModel, messageId: string) {
  if (!model.interactionFragments) return;
  Object.values(model.interactionFragments).forEach((frag) => {
    frag.operands.forEach((op) => {
      op.messageIds = op.messageIds.filter((mid) => mid !== messageId);
    });
  });
}

/**
 * Core message + auto-activation insertion shared by createMessage and
 * insertMessageAt. Mutates the draft model in place; the caller is responsible
 * for bumping updatedAt and for any sequenceNumber reflow.
 */
function applyMessageCreation(
  model: SemanticModel,
  id: string,
  activationId: string,
  data: Omit<IRMessage, 'id' | 'kind'>,
) {
  model.messages = model.messages ?? {};
  model.activations = model.activations ?? {};
  model.messages[id] = { ...data, id, kind: 'MESSAGE' };

  // Auto-create an activation on the target lifeline for SYNC messages.
  if (data.messageKind === 'SYNC') {
    model.activations[activationId] = {
      id: activationId,
      kind: 'ACTIVATION',
      name: '',
      lifelineId: data.targetLifelineId,
      startMessageId: id,
    };
  }

  // For REPLY messages, close the matching open activation on the source side.
  if (data.messageKind === 'REPLY' && data.inReplyTo) {
    const acts = model.activations;
    for (const aid of Object.keys(acts)) {
      const act = acts[aid];
      if (act.startMessageId === data.inReplyTo && !act.endMessageId) {
        act.endMessageId = id;
        break;
      }
    }
  }
}

/** Clears gate references on every message for the given (deleted) gate ids. */
function clearGateRefsOnMessages(model: SemanticModel, gateIds: Set<string>) {
  if (!model.messages || gateIds.size === 0) return;
  Object.values(model.messages).forEach((m) => {
    if (m.sourceGateId && gateIds.has(m.sourceGateId)) delete (m as { sourceGateId?: string }).sourceGateId;
    if (m.targetGateId && gateIds.has(m.targetGateId)) delete (m as { targetGateId?: string }).targetGateId;
  });
}

/** Deletes general orderings that reference any of the given (deleted) message ids. */
function clearGeneralOrderingsForMessages(model: SemanticModel, messageIds: Set<string>) {
  if (!model.generalOrderings || messageIds.size === 0) return;
  for (const oid of Object.keys(model.generalOrderings)) {
    const go = model.generalOrderings[oid];
    if (messageIds.has(go.beforeMessageId) || messageIds.has(go.afterMessageId)) {
      delete model.generalOrderings[oid];
    }
  }
}

/** Deletes time/duration constraints anchored to any of the given (deleted) message ids. */
function clearTimeConstraintsForMessages(model: SemanticModel, messageIds: Set<string>) {
  if (!model.timeConstraints || messageIds.size === 0) return;
  for (const tid of Object.keys(model.timeConstraints)) {
    const tc = model.timeConstraints[tid];
    if (
      messageIds.has(tc.fromMessageId) ||
      (tc.toMessageId !== undefined && messageIds.has(tc.toMessageId))
    ) {
      delete model.timeConstraints[tid];
    }
  }
}

/** Deletes all gates owned by a fragment and clears their message references. */
function removeGatesForFragment(model: SemanticModel, fragmentId: string) {
  if (!model.gates) return;
  const removed = new Set<string>();
  Object.keys(model.gates).forEach((gid) => {
    if (model.gates![gid].ownerFragmentId === fragmentId) {
      removed.add(gid);
      delete model.gates![gid];
    }
  });
  clearGateRefsOnMessages(model, removed);
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
  /**
   * Insert a message at the 1-based slot carried in `data.sequenceNumber`,
   * shifting existing messages at or after that slot down by one. Backs the
   * "drop where you point" sequence-diagram UX (P1).
   */
  insertMessageAt: (data: Omit<IRMessage, 'id' | 'kind'>) => string;
  updateMessage: (id: string, patch: Partial<IRMessage>) => void;
  deleteMessage: (id: string) => void;
  reorderMessages: (updates: Array<{ id: string; sequenceNumber: number }>) => void;

  createActivation: (data: Omit<IRActivation, 'id' | 'kind'>) => string;
  updateActivation: (id: string, patch: Partial<IRActivation>) => void;
  deleteActivation: (id: string) => void;

  createFragment: (data: Omit<IRInteractionFragment, 'id' | 'kind'>) => string;
  updateFragment: (id: string, patch: Partial<IRInteractionFragment>) => void;
  deleteFragment: (id: string) => void;

  createStateInvariant: (data: Omit<IRStateInvariant, 'id' | 'kind'>) => string;
  updateStateInvariant: (id: string, patch: Partial<IRStateInvariant>) => void;
  deleteStateInvariant: (id: string) => void;

  createInteractionUse: (data: Omit<IRInteractionUse, 'id' | 'kind'>) => string;
  updateInteractionUse: (id: string, patch: Partial<IRInteractionUse>) => void;
  deleteInteractionUse: (id: string) => void;

  createGate: (data: Omit<IRGate, 'id' | 'kind'>) => string;
  updateGate: (id: string, patch: Partial<IRGate>) => void;
  deleteGate: (id: string) => void;

  createGeneralOrdering: (data: Omit<IRGeneralOrdering, 'id' | 'kind'>) => string;
  updateGeneralOrdering: (id: string, patch: Partial<IRGeneralOrdering>) => void;
  deleteGeneralOrdering: (id: string) => void;

  createTimeConstraint: (data: Omit<IRTimeConstraint, 'id' | 'kind'>) => string;
  updateTimeConstraint: (id: string, patch: Partial<IRTimeConstraint>) => void;
  deleteTimeConstraint: (id: string) => void;

  createCoregion: (data: Omit<IRCoregion, 'id' | 'kind'>) => string;
  updateCoregion: (id: string, patch: Partial<IRCoregion>) => void;
  deleteCoregion: (id: string) => void;

  createContinuation: (data: Omit<IRContinuation, 'id' | 'kind'>) => string;
  updateContinuation: (id: string, patch: Partial<IRContinuation>) => void;
  deleteContinuation: (id: string) => void;

  createRelation: (data: Omit<IRRelation, 'id'>) => string;
  updateRelation: (id: string, patch: Partial<Omit<IRRelation, 'id'>>) => void;
  deleteRelation: (id: string) => void;

  integrateExternalElement: (elementId: string) => void;
  untrackElement: (elementId: string) => void;
  /**
   * Bulk-merges remapped element collections into the global model (Add to
   * Project). Ids are pre-remapped to fresh UUIDs by mergeStandaloneModel, so a
   * shallow spread per collection cannot collide. One undo entry.
   */
  mergeModelElements: (elements: Partial<SemanticModel>, packageNames?: string[]) => void;
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
          activations: {},
          interactionFragments: {},
          stateInvariants: {},
          interactionUses: {},
          gates: {},
          generalOrderings: {},
          timeConstraints: {},
          coregions: {},
          continuations: {},
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
      const activationId = newId();
      withUndo('model', `Create Message: ${data.name || data.messageKind}`, 'global', (draft) => {
        if (!draft.model) return;
        applyMessageCreation(draft.model, id, activationId, data);
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    insertMessageAt: (data) => {
      const id = newId();
      const activationId = newId();
      withUndo('model', `Insert Message: ${data.name || data.messageKind}`, 'global', (draft) => {
        if (!draft.model) return;
        // `data.sequenceNumber` is the 1-based slot where the user dropped the
        // message. Shift every existing message at or after that slot down by one
        // so the new message takes the slot and the rest stay contiguous.
        const slot = data.sequenceNumber;
        if (draft.model.messages) {
          for (const mid of Object.keys(draft.model.messages)) {
            const m = draft.model.messages[mid];
            if (m.sequenceNumber >= slot) m.sequenceNumber += 1;
          }
        }
        applyMessageCreation(draft.model, id, activationId, data);
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
        const removedMsgIds = new Set<string>([id]);
        delete draft.model.messages[id];
        // Cascade: REPLY messages that reference this one.
        Object.keys(draft.model.messages).forEach((mid) => {
          if (draft.model.messages![mid].inReplyTo === id) {
            removedMsgIds.add(mid);
            delete draft.model.messages![mid];
            stripMessageFromFragments(draft.model, mid);
          }
        });
        cascadeDeleteActivationsForMessage(draft.model, id);
        stripMessageFromFragments(draft.model, id);
        clearGeneralOrderingsForMessages(draft.model, removedMsgIds);
        clearTimeConstraintsForMessages(draft.model, removedMsgIds);
        draft.model.updatedAt = Date.now();
      });
    },

    reorderMessages: (updates) => {
      withUndo('model', 'Reorder Messages', 'global', (draft) => {
        if (!draft.model?.messages) return;
        for (const { id, sequenceNumber } of updates) {
          if (draft.model.messages[id]) {
            draft.model.messages[id].sequenceNumber = sequenceNumber;
          }
        }
        draft.model.updatedAt = Date.now();
      });
    },

    createActivation: (data) => {
      const id = newId();
      withUndo('model', 'Create Activation', 'global', (draft) => {
        if (!draft.model) return;
        draft.model.activations = draft.model.activations ?? {};
        draft.model.activations[id] = { ...data, id, kind: 'ACTIVATION' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateActivation: (id, patch) => {
      withUndo('model', 'Update Activation', 'global', (draft) => {
        if (!draft.model?.activations?.[id]) return;
        draft.model.activations[id] = { ...draft.model.activations[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteActivation: (id) => {
      withUndo('model', 'Delete Activation', 'global', (draft) => {
        if (!draft.model?.activations?.[id]) return;
        delete draft.model.activations[id];
        draft.model.updatedAt = Date.now();
      });
    },

    createFragment: (data) => {
      const id = newId();
      withUndo('model', `Create Fragment: ${data.fragmentKind}`, 'global', (draft) => {
        if (!draft.model) return;
        draft.model.interactionFragments = draft.model.interactionFragments ?? {};
        draft.model.interactionFragments[id] = { ...data, id, kind: 'FRAGMENT' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateFragment: (id, patch) => {
      withUndo('model', 'Update Fragment', 'global', (draft) => {
        if (!draft.model?.interactionFragments?.[id]) return;
        draft.model.interactionFragments[id] = {
          ...draft.model.interactionFragments[id],
          ...patch,
        };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteFragment: (id) => {
      withUndo('model', 'Delete Fragment', 'global', (draft) => {
        if (!draft.model?.interactionFragments?.[id]) return;
        const fragments = draft.model.interactionFragments as Record<string, IRInteractionFragment>;
        // Re-parent children: clear their parentFragmentId. The plan §7.3 / §11.3
        // calls for cascade-configurable; default to "orphan children to root".
        for (const other of Object.values(fragments)) {
          if (other.parentFragmentId === id) {
            delete (other as { parentFragmentId?: string }).parentFragmentId;
          }
          // Strip from any parent's operand fragmentIds.
          other.operands.forEach((op) => {
            op.fragmentIds = op.fragmentIds.filter((fid) => fid !== id);
          });
        }
        // Strip messages contained in this fragment of their fragmentId.
        if (draft.model.messages) {
          const messages = draft.model.messages as Record<string, IRMessage>;
          for (const m of Object.values(messages)) {
            if (m.fragmentId === id) delete (m as { fragmentId?: string }).fragmentId;
          }
        }
        // Gates live on this fragment's boundary — delete them with it.
        removeGatesForFragment(draft.model, id);
        delete draft.model.interactionFragments[id];
        draft.model.updatedAt = Date.now();
      });
    },

    createStateInvariant: (data) => {
      const id = newId();
      withUndo('model', 'Create State Invariant', 'global', (draft) => {
        if (!draft.model) return;
        draft.model.stateInvariants = draft.model.stateInvariants ?? {};
        draft.model.stateInvariants[id] = { ...data, id, kind: 'STATE_INVARIANT' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateStateInvariant: (id, patch) => {
      withUndo('model', 'Update State Invariant', 'global', (draft) => {
        if (!draft.model?.stateInvariants?.[id]) return;
        draft.model.stateInvariants[id] = { ...draft.model.stateInvariants[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteStateInvariant: (id) => {
      withUndo('model', 'Delete State Invariant', 'global', (draft) => {
        if (!draft.model?.stateInvariants?.[id]) return;
        delete draft.model.stateInvariants[id];
        draft.model.updatedAt = Date.now();
      });
    },

    createInteractionUse: (data) => {
      const id = newId();
      withUndo('model', 'Create Interaction Use', 'global', (draft) => {
        if (!draft.model) return;
        draft.model.interactionUses = draft.model.interactionUses ?? {};
        draft.model.interactionUses[id] = { ...data, id, kind: 'INTERACTION_USE' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateInteractionUse: (id, patch) => {
      withUndo('model', 'Update Interaction Use', 'global', (draft) => {
        if (!draft.model?.interactionUses?.[id]) return;
        draft.model.interactionUses[id] = { ...draft.model.interactionUses[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteInteractionUse: (id) => {
      withUndo('model', 'Delete Interaction Use', 'global', (draft) => {
        if (!draft.model?.interactionUses?.[id]) return;
        delete draft.model.interactionUses[id];
        draft.model.updatedAt = Date.now();
      });
    },

    createGate: (data) => {
      const id = newId();
      withUndo('model', 'Create Gate', 'global', (draft) => {
        if (!draft.model) return;
        draft.model.gates = draft.model.gates ?? {};
        draft.model.gates[id] = { ...data, id, kind: 'GATE' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateGate: (id, patch) => {
      withUndo('model', 'Update Gate', 'global', (draft) => {
        if (!draft.model?.gates?.[id]) return;
        draft.model.gates[id] = { ...draft.model.gates[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteGate: (id) => {
      withUndo('model', 'Delete Gate', 'global', (draft) => {
        if (!draft.model?.gates?.[id]) return;
        delete draft.model.gates[id];
        clearGateRefsOnMessages(draft.model, new Set([id]));
        draft.model.updatedAt = Date.now();
      });
    },

    createGeneralOrdering: (data) => {
      const id = newId();
      withUndo('model', 'Create General Ordering', 'global', (draft) => {
        if (!draft.model) return;
        draft.model.generalOrderings = draft.model.generalOrderings ?? {};
        draft.model.generalOrderings[id] = { ...data, id, kind: 'GENERAL_ORDERING' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateGeneralOrdering: (id, patch) => {
      withUndo('model', 'Update General Ordering', 'global', (draft) => {
        if (!draft.model?.generalOrderings?.[id]) return;
        draft.model.generalOrderings[id] = { ...draft.model.generalOrderings[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteGeneralOrdering: (id) => {
      withUndo('model', 'Delete General Ordering', 'global', (draft) => {
        if (!draft.model?.generalOrderings?.[id]) return;
        delete draft.model.generalOrderings[id];
        draft.model.updatedAt = Date.now();
      });
    },

    createTimeConstraint: (data) => {
      const id = newId();
      withUndo('model', 'Create Time Constraint', 'global', (draft) => {
        if (!draft.model) return;
        draft.model.timeConstraints = draft.model.timeConstraints ?? {};
        draft.model.timeConstraints[id] = { ...data, id, kind: 'TIME_CONSTRAINT' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateTimeConstraint: (id, patch) => {
      withUndo('model', 'Update Time Constraint', 'global', (draft) => {
        if (!draft.model?.timeConstraints?.[id]) return;
        draft.model.timeConstraints[id] = { ...draft.model.timeConstraints[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteTimeConstraint: (id) => {
      withUndo('model', 'Delete Time Constraint', 'global', (draft) => {
        if (!draft.model?.timeConstraints?.[id]) return;
        delete draft.model.timeConstraints[id];
        draft.model.updatedAt = Date.now();
      });
    },

    createCoregion: (data) => {
      const id = newId();
      withUndo('model', 'Create Coregion', 'global', (draft) => {
        if (!draft.model) return;
        draft.model.coregions = draft.model.coregions ?? {};
        draft.model.coregions[id] = { ...data, id, kind: 'COREGION' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateCoregion: (id, patch) => {
      withUndo('model', 'Update Coregion', 'global', (draft) => {
        if (!draft.model?.coregions?.[id]) return;
        draft.model.coregions[id] = { ...draft.model.coregions[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteCoregion: (id) => {
      withUndo('model', 'Delete Coregion', 'global', (draft) => {
        if (!draft.model?.coregions?.[id]) return;
        delete draft.model.coregions[id];
        draft.model.updatedAt = Date.now();
      });
    },

    createContinuation: (data) => {
      const id = newId();
      withUndo('model', 'Create Continuation', 'global', (draft) => {
        if (!draft.model) return;
        draft.model.continuations = draft.model.continuations ?? {};
        draft.model.continuations[id] = { ...data, id, kind: 'CONTINUATION' };
        draft.model.updatedAt = Date.now();
      });
      return id;
    },

    updateContinuation: (id, patch) => {
      withUndo('model', 'Update Continuation', 'global', (draft) => {
        if (!draft.model?.continuations?.[id]) return;
        draft.model.continuations[id] = { ...draft.model.continuations[id], ...patch };
        draft.model.updatedAt = Date.now();
      });
    },

    deleteContinuation: (id) => {
      withUndo('model', 'Delete Continuation', 'global', (draft) => {
        if (!draft.model?.continuations?.[id]) return;
        delete draft.model.continuations[id];
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

    mergeModelElements: (elements, packageNames) =>
      withUndo('model', 'Add to Project', 'global', (draft) => {
        if (!draft.model) return;
        const model = draft.model as unknown as Record<string, Record<string, unknown>>;
        for (const [key, incoming] of Object.entries(elements)) {
          if (!incoming || typeof incoming !== 'object') continue;
          model[key] = { ...(model[key] ?? {}), ...(incoming as Record<string, unknown>) };
        }
        if (packageNames?.length) {
          if (!draft.model.packageNames) draft.model.packageNames = [];
          for (const p of packageNames) {
            if (p && !draft.model.packageNames.includes(p)) draft.model.packageNames.push(p);
          }
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
