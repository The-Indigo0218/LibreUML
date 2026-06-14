/**
 * standaloneModelOps.ts
 *
 * Provides a SemanticModel CRUD API scoped to a single VFSFile's localModel.
 *
 * Every method routes through useVFSStore.updateLocalModel, which deep-clones
 * the current localModel, applies the mutation, and persists the result back
 * into VFSStore.  Zero contact with useModelStore — complete isolation.
 *
 * Usage:
 *   const ops = standaloneModelOps(fileId);
 *   const id  = ops.createClass({ name: 'Foo', ... });
 *   ops.deleteRelation(relId);
 */

import { useVFSStore } from './project-vfs.store';
import type {
  VFSFile,
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
} from '../core/domain/vfs/vfs.types';
import { getPackageHierarchy } from '../utils/packageHelpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cascadeDeleteRelations(model: SemanticModel, elementId: string) {
  for (const rid of Object.keys(model.relations)) {
    const rel = model.relations[rid];
    if (rel.sourceId === elementId || rel.targetId === elementId) {
      delete model.relations[rid];
    }
  }
}

function cascadeDeleteMessagesByLifeline(model: SemanticModel, lifelineId: string) {
  if (!model.messages) return;
  const removed = new Set<string>();
  for (const mid of Object.keys(model.messages)) {
    const msg = model.messages[mid];
    if (msg.sourceLifelineId === lifelineId || msg.targetLifelineId === lifelineId) {
      removed.add(mid);
      delete model.messages[mid];
    }
  }
  if (model.activations) {
    for (const aid of Object.keys(model.activations)) {
      const act = model.activations[aid];
      if (
        act.lifelineId === lifelineId ||
        removed.has(act.startMessageId) ||
        (act.endMessageId && removed.has(act.endMessageId))
      ) {
        delete model.activations[aid];
      }
    }
  }
  if (model.interactionFragments) {
    for (const fid of Object.keys(model.interactionFragments)) {
      const frag = model.interactionFragments[fid];
      frag.coveredLifelineIds = frag.coveredLifelineIds.filter((id) => id !== lifelineId);
      frag.operands.forEach((op) => {
        op.messageIds = op.messageIds.filter((mid) => !removed.has(mid));
      });
      if (frag.coveredLifelineIds.length === 0) {
        removeGatesForFragmentLocal(model, fid);
        delete model.interactionFragments[fid];
      }
    }
  }
  if (model.stateInvariants) {
    for (const sid of Object.keys(model.stateInvariants)) {
      if (model.stateInvariants[sid].lifelineId === lifelineId) {
        delete model.stateInvariants[sid];
      }
    }
  }
  if (model.interactionUses) {
    for (const uid of Object.keys(model.interactionUses)) {
      const use = model.interactionUses[uid];
      use.coveredLifelineIds = use.coveredLifelineIds.filter((id) => id !== lifelineId);
      if (use.coveredLifelineIds.length === 0) {
        delete model.interactionUses[uid];
      }
    }
  }
}

function cascadeDeleteActivationsForMessageLocal(model: SemanticModel, messageId: string) {
  if (!model.activations) return;
  for (const aid of Object.keys(model.activations)) {
    const act = model.activations[aid];
    if (act.startMessageId === messageId) {
      delete model.activations[aid];
    } else if (act.endMessageId === messageId) {
      delete (model.activations[aid] as { endMessageId?: string }).endMessageId;
    }
  }
}

function stripMessageFromFragmentsLocal(model: SemanticModel, messageId: string) {
  if (!model.interactionFragments) return;
  for (const frag of Object.values(model.interactionFragments)) {
    frag.operands.forEach((op) => {
      op.messageIds = op.messageIds.filter((mid) => mid !== messageId);
    });
  }
}

function clearGateRefsOnMessagesLocal(model: SemanticModel, gateIds: Set<string>) {
  if (!model.messages || gateIds.size === 0) return;
  for (const m of Object.values(model.messages)) {
    if (m.sourceGateId && gateIds.has(m.sourceGateId)) delete (m as { sourceGateId?: string }).sourceGateId;
    if (m.targetGateId && gateIds.has(m.targetGateId)) delete (m as { targetGateId?: string }).targetGateId;
  }
}

function clearGeneralOrderingsForMessagesLocal(model: SemanticModel, messageIds: Set<string>) {
  if (!model.generalOrderings || messageIds.size === 0) return;
  for (const oid of Object.keys(model.generalOrderings)) {
    const go = model.generalOrderings[oid];
    if (messageIds.has(go.beforeMessageId) || messageIds.has(go.afterMessageId)) {
      delete model.generalOrderings[oid];
    }
  }
}

function removeGatesForFragmentLocal(model: SemanticModel, fragmentId: string) {
  if (!model.gates) return;
  const removed = new Set<string>();
  for (const gid of Object.keys(model.gates)) {
    if (model.gates[gid].ownerFragmentId === fragmentId) {
      removed.add(gid);
      delete model.gates[gid];
    }
  }
  clearGateRefsOnMessagesLocal(model, removed);
}

/** Reads the localModel for a file directly from VFSStore (no subscription). */
export function getLocalModel(fileId: string): SemanticModel | null {
  const project = useVFSStore.getState().project;
  if (!project) return null;
  const node = project.nodes[fileId];
  if (!node || node.type !== 'FILE') return null;
  return (node as VFSFile).localModel ?? null;
}

/** Ensures a localModel is present on the file, initialising one if absent. */
export function ensureLocalModel(fileId: string): void {
  if (!getLocalModel(fileId)) {
    useVFSStore.getState().initLocalModel(fileId);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Returns a CRUD-operations object scoped to `fileId`'s localModel.
 * All mutations are atomic immutable updates via VFSStore.updateLocalModel.
 */
export function standaloneModelOps(fileId: string) {
  const update = (fn: (m: SemanticModel) => void) =>
    useVFSStore.getState().updateLocalModel(fileId, fn);

  return {
    // ── Class ────────────────────────────────────────────────────────────────

    createClass: (data: Omit<IRClass, 'id' | 'kind'>): string => {
      const id = crypto.randomUUID();
      update((m) => {
        // Auto-create intermediate packages if packageName contains dots
        if (data.packageName) {
          const hierarchy = getPackageHierarchy(data.packageName);
          if (!m.packageNames) m.packageNames = [];
          hierarchy.forEach(pkg => {
            if (m.packageNames && !m.packageNames.includes(pkg)) {
              m.packageNames.push(pkg);
            }
          });
        }
        
        m.classes[id] = { ...data, id, kind: 'CLASS' };
        m.updatedAt = Date.now();
      });
      return id;
    },

    createAbstractClass: (data: Omit<IRClass, 'id' | 'kind' | 'isAbstract'>): string => {
      const id = crypto.randomUUID();
      update((m) => {
        // Auto-create intermediate packages if packageName contains dots
        if (data.packageName) {
          const hierarchy = getPackageHierarchy(data.packageName);
          if (!m.packageNames) m.packageNames = [];
          hierarchy.forEach(pkg => {
            if (m.packageNames && !m.packageNames.includes(pkg)) {
              m.packageNames.push(pkg);
            }
          });
        }
        
        m.classes[id] = { ...data, id, kind: 'CLASS', isAbstract: true };
        m.updatedAt = Date.now();
      });
      return id;
    },

    updateClass: (id: string, patch: Partial<IRClass>) => {
      update((m) => {
        if (!m.classes[id]) return;
        m.classes[id] = { ...m.classes[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    deleteClass: (id: string) => {
      update((m) => {
        delete m.classes[id];
        cascadeDeleteRelations(m, id);
        m.updatedAt = Date.now();
      });
    },

    // ── Interface ─────────────────────────────────────────────────────────────

    createInterface: (data: Omit<IRInterface, 'id' | 'kind'>): string => {
      const id = crypto.randomUUID();
      update((m) => {
        // Auto-create intermediate packages if packageName contains dots
        if (data.packageName) {
          const hierarchy = getPackageHierarchy(data.packageName);
          if (!m.packageNames) m.packageNames = [];
          hierarchy.forEach(pkg => {
            if (m.packageNames && !m.packageNames.includes(pkg)) {
              m.packageNames.push(pkg);
            }
          });
        }
        
        m.interfaces[id] = { ...data, id, kind: 'INTERFACE' };
        m.updatedAt = Date.now();
      });
      return id;
    },

    updateInterface: (id: string, patch: Partial<IRInterface>) => {
      update((m) => {
        if (!m.interfaces[id]) return;
        m.interfaces[id] = { ...m.interfaces[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    deleteInterface: (id: string) => {
      update((m) => {
        delete m.interfaces[id];
        cascadeDeleteRelations(m, id);
        m.updatedAt = Date.now();
      });
    },

    // ── Enum ──────────────────────────────────────────────────────────────────

    createEnum: (data: Omit<IREnum, 'id' | 'kind'>): string => {
      const id = crypto.randomUUID();
      update((m) => {
        // Auto-create intermediate packages if packageName contains dots
        if (data.packageName) {
          const hierarchy = getPackageHierarchy(data.packageName);
          if (!m.packageNames) m.packageNames = [];
          hierarchy.forEach(pkg => {
            if (m.packageNames && !m.packageNames.includes(pkg)) {
              m.packageNames.push(pkg);
            }
          });
        }
        
        m.enums[id] = { ...data, id, kind: 'ENUM' };
        m.updatedAt = Date.now();
      });
      return id;
    },

    updateEnum: (id: string, patch: Partial<IREnum>) => {
      update((m) => {
        if (!m.enums[id]) return;
        m.enums[id] = { ...m.enums[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    deleteEnum: (id: string) => {
      update((m) => {
        delete m.enums[id];
        cascadeDeleteRelations(m, id);
        m.updatedAt = Date.now();
      });
    },

    updateActor: (id: string, patch: Partial<IRActor>) => {
      update((m) => {
        if (!m.actors?.[id]) return;
        m.actors[id] = { ...m.actors[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    updateUseCase: (id: string, patch: Partial<IRUseCase>) => {
      update((m) => {
        if (!m.useCases?.[id]) return;
        m.useCases[id] = { ...m.useCases[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    updateSystemBoundary: (id: string, patch: Partial<IRSystemBoundary>) => {
      update((m) => {
        if (!m.systemBoundaries?.[id]) return;
        m.systemBoundaries![id] = { ...m.systemBoundaries![id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    updateUCModule: (id: string, patch: Partial<IRUCModule>) => {
      update((m) => {
        if (!m.ucModules?.[id]) return;
        m.ucModules![id] = { ...m.ucModules![id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    // ── Domain Entity ─────────────────────────────────────────────────────────

    createDomainEntity: (data: Omit<IRDomainEntity, 'id' | 'kind'>): string => {
      const id = crypto.randomUUID();
      update((m) => {
        m.domainEntities = m.domainEntities ?? {};
        m.domainAttributes = m.domainAttributes ?? {};
        m.domainEntities[id] = { ...data, id, kind: 'DOMAIN_ENTITY' };
        m.updatedAt = Date.now();
      });
      return id;
    },

    updateDomainEntity: (id: string, patch: Partial<IRDomainEntity>) => {
      update((m) => {
        if (!m.domainEntities?.[id]) return;
        m.domainEntities[id] = { ...m.domainEntities[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    setDomainEntityAttributes: (id: string, attributes: IRDomainAttribute[]) => {
      update((m) => {
        if (!m.domainEntities?.[id]) return;
        m.domainAttributes = m.domainAttributes ?? {};
        const entity = m.domainEntities[id];
        entity.attributeIds.forEach((aid) => { delete m.domainAttributes![aid]; });
        attributes.forEach((a) => { m.domainAttributes![a.id] = a; });
        entity.attributeIds = attributes.map((a) => a.id);
        m.updatedAt = Date.now();
      });
    },

    deleteDomainEntity: (id: string) => {
      update((m) => {
        m.domainAttributes = m.domainAttributes ?? {};
        const entity = m.domainEntities?.[id];
        if (entity) {
          entity.attributeIds.forEach((aid) => { delete m.domainAttributes![aid]; });
          delete m.domainEntities![id];
        }
        cascadeDeleteRelations(m, id);
        m.updatedAt = Date.now();
      });
    },

    // ── Members ───────────────────────────────────────────────────────────────

    setElementMembers: (
      elementId: string,
      attributes: IRAttribute[],
      operations: IROperation[],
    ) => {
      update((m) => {
        const cls = m.classes[elementId];
        const iface = m.interfaces[elementId];
        if (cls) {
          cls.attributeIds.forEach((aid) => { delete m.attributes[aid]; });
          cls.operationIds.forEach((oid) => { delete m.operations[oid]; });
          attributes.forEach((a) => { m.attributes[a.id] = a; });
          operations.forEach((o) => { m.operations[o.id] = o; });
          m.classes[elementId].attributeIds = attributes.map((a) => a.id);
          m.classes[elementId].operationIds = operations.map((o) => o.id);
        } else if (iface) {
          (iface.attributeIds ?? []).forEach((aid) => { delete m.attributes[aid]; });
          iface.operationIds.forEach((oid) => { delete m.operations[oid]; });
          attributes.forEach((a) => { m.attributes[a.id] = a; });
          operations.forEach((o) => { m.operations[o.id] = o; });
          m.interfaces[elementId].attributeIds = attributes.map((a) => a.id);
          m.interfaces[elementId].operationIds = operations.map((o) => o.id);
        }
        m.updatedAt = Date.now();
      });
    },

    // ── Relations ─────────────────────────────────────────────────────────────

    createRelation: (data: Omit<IRRelation, 'id'>): string => {
      const id = crypto.randomUUID();
      update((m) => { m.relations[id] = { ...data, id }; m.updatedAt = Date.now(); });
      return id;
    },

    updateRelation: (id: string, patch: Partial<Omit<IRRelation, 'id'>>) => {
      update((m) => {
        if (!m.relations[id]) return;
        m.relations[id] = { ...m.relations[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    deleteRelation: (id: string) => {
      update((m) => {
        delete m.relations[id];
        m.updatedAt = Date.now();
      });
    },

    // ── Lifelines (sequence diagrams) ─────────────────────────────────────────

    createLifeline: (data: Omit<IRLifeline, 'id' | 'kind'>): string => {
      const id = crypto.randomUUID();
      update((m) => {
        m.lifelines = m.lifelines ?? {};
        m.lifelines[id] = { ...data, id, kind: 'LIFELINE' };
        m.updatedAt = Date.now();
      });
      return id;
    },

    updateLifeline: (id: string, patch: Partial<IRLifeline>) => {
      update((m) => {
        if (!m.lifelines?.[id]) return;
        m.lifelines[id] = { ...m.lifelines[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    deleteLifeline: (id: string) => {
      update((m) => {
        if (!m.lifelines?.[id]) return;
        delete m.lifelines[id];
        cascadeDeleteMessagesByLifeline(m, id);
        m.updatedAt = Date.now();
      });
    },

    // ── Messages (sequence diagrams) ──────────────────────────────────────────

    createMessage: (data: Omit<IRMessage, 'id' | 'kind'>): string => {
      const id = crypto.randomUUID();
      const activationId = crypto.randomUUID();
      update((m) => {
        m.messages = m.messages ?? {};
        m.activations = m.activations ?? {};
        m.messages[id] = { ...data, id, kind: 'MESSAGE' };

        if (data.messageKind === 'SYNC') {
          m.activations[activationId] = {
            id: activationId,
            kind: 'ACTIVATION',
            name: '',
            lifelineId: data.targetLifelineId,
            startMessageId: id,
          };
        }

        if (data.messageKind === 'REPLY' && data.inReplyTo) {
          for (const aid of Object.keys(m.activations)) {
            const act = m.activations[aid];
            if (act.startMessageId === data.inReplyTo && !act.endMessageId) {
              act.endMessageId = id;
              break;
            }
          }
        }

        m.updatedAt = Date.now();
      });
      return id;
    },

    insertMessageAt: (data: Omit<IRMessage, 'id' | 'kind'>): string => {
      const id = crypto.randomUUID();
      const activationId = crypto.randomUUID();
      update((m) => {
        m.messages = m.messages ?? {};
        m.activations = m.activations ?? {};

        // `data.sequenceNumber` is the 1-based slot where the user dropped the
        // message. Shift every existing message at or after that slot down by one.
        const slot = data.sequenceNumber;
        for (const existing of Object.values(m.messages)) {
          if (existing.sequenceNumber >= slot) existing.sequenceNumber += 1;
        }

        m.messages[id] = { ...data, id, kind: 'MESSAGE' };

        if (data.messageKind === 'SYNC') {
          m.activations[activationId] = {
            id: activationId,
            kind: 'ACTIVATION',
            name: '',
            lifelineId: data.targetLifelineId,
            startMessageId: id,
          };
        }

        if (data.messageKind === 'REPLY' && data.inReplyTo) {
          for (const aid of Object.keys(m.activations)) {
            const act = m.activations[aid];
            if (act.startMessageId === data.inReplyTo && !act.endMessageId) {
              act.endMessageId = id;
              break;
            }
          }
        }

        m.updatedAt = Date.now();
      });
      return id;
    },

    updateMessage: (id: string, patch: Partial<IRMessage>) => {
      update((m) => {
        if (!m.messages?.[id]) return;
        m.messages[id] = { ...m.messages[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    deleteMessage: (id: string) => {
      update((m) => {
        if (!m.messages?.[id]) return;
        const removedMsgIds = new Set<string>([id]);
        delete m.messages[id];
        for (const mid of Object.keys(m.messages)) {
          if (m.messages[mid].inReplyTo === id) {
            removedMsgIds.add(mid);
            delete m.messages[mid];
            stripMessageFromFragmentsLocal(m, mid);
          }
        }
        cascadeDeleteActivationsForMessageLocal(m, id);
        stripMessageFromFragmentsLocal(m, id);
        clearGeneralOrderingsForMessagesLocal(m, removedMsgIds);
        m.updatedAt = Date.now();
      });
    },

    reorderMessages: (updates: Array<{ id: string; sequenceNumber: number }>) => {
      update((m) => {
        if (!m.messages) return;
        for (const { id, sequenceNumber } of updates) {
          if (m.messages[id]) {
            m.messages[id].sequenceNumber = sequenceNumber;
          }
        }
        m.updatedAt = Date.now();
      });
    },

    // ── Activations (sequence diagrams) ───────────────────────────────────────

    createActivation: (data: Omit<IRActivation, 'id' | 'kind'>): string => {
      const id = crypto.randomUUID();
      update((m) => {
        m.activations = m.activations ?? {};
        m.activations[id] = { ...data, id, kind: 'ACTIVATION' };
        m.updatedAt = Date.now();
      });
      return id;
    },

    updateActivation: (id: string, patch: Partial<IRActivation>) => {
      update((m) => {
        if (!m.activations?.[id]) return;
        m.activations[id] = { ...m.activations[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    deleteActivation: (id: string) => {
      update((m) => {
        if (!m.activations?.[id]) return;
        delete m.activations[id];
        m.updatedAt = Date.now();
      });
    },

    // ── Combined Fragments (sequence diagrams) ────────────────────────────────

    createFragment: (data: Omit<IRInteractionFragment, 'id' | 'kind'>): string => {
      const id = crypto.randomUUID();
      update((m) => {
        m.interactionFragments = m.interactionFragments ?? {};
        m.interactionFragments[id] = { ...data, id, kind: 'FRAGMENT' };
        m.updatedAt = Date.now();
      });
      return id;
    },

    updateFragment: (id: string, patch: Partial<IRInteractionFragment>) => {
      update((m) => {
        if (!m.interactionFragments?.[id]) return;
        m.interactionFragments[id] = { ...m.interactionFragments[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    deleteFragment: (id: string) => {
      update((m) => {
        if (!m.interactionFragments?.[id]) return;
        for (const other of Object.values(m.interactionFragments)) {
          if (other.parentFragmentId === id) {
            delete (other as { parentFragmentId?: string }).parentFragmentId;
          }
          other.operands.forEach((op) => {
            op.fragmentIds = op.fragmentIds.filter((fid) => fid !== id);
          });
        }
        if (m.messages) {
          for (const msg of Object.values(m.messages)) {
            if (msg.fragmentId === id) delete (msg as { fragmentId?: string }).fragmentId;
          }
        }
        removeGatesForFragmentLocal(m, id);
        delete m.interactionFragments[id];
        m.updatedAt = Date.now();
      });
    },

    // ── State Invariants (sequence diagrams) ──────────────────────────────────

    createStateInvariant: (data: Omit<IRStateInvariant, 'id' | 'kind'>): string => {
      const id = crypto.randomUUID();
      update((m) => {
        m.stateInvariants = m.stateInvariants ?? {};
        m.stateInvariants[id] = { ...data, id, kind: 'STATE_INVARIANT' };
        m.updatedAt = Date.now();
      });
      return id;
    },

    updateStateInvariant: (id: string, patch: Partial<IRStateInvariant>) => {
      update((m) => {
        if (!m.stateInvariants?.[id]) return;
        m.stateInvariants[id] = { ...m.stateInvariants[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    deleteStateInvariant: (id: string) => {
      update((m) => {
        if (!m.stateInvariants?.[id]) return;
        delete m.stateInvariants[id];
        m.updatedAt = Date.now();
      });
    },

    // ── Interaction Uses (`ref`) ──────────────────────────────────────────────

    createInteractionUse: (data: Omit<IRInteractionUse, 'id' | 'kind'>): string => {
      const id = crypto.randomUUID();
      update((m) => {
        m.interactionUses = m.interactionUses ?? {};
        m.interactionUses[id] = { ...data, id, kind: 'INTERACTION_USE' };
        m.updatedAt = Date.now();
      });
      return id;
    },

    updateInteractionUse: (id: string, patch: Partial<IRInteractionUse>) => {
      update((m) => {
        if (!m.interactionUses?.[id]) return;
        m.interactionUses[id] = { ...m.interactionUses[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    deleteInteractionUse: (id: string) => {
      update((m) => {
        if (!m.interactionUses?.[id]) return;
        delete m.interactionUses[id];
        m.updatedAt = Date.now();
      });
    },

    // ── Gates (`gate`) ────────────────────────────────────────────────────────

    createGate: (data: Omit<IRGate, 'id' | 'kind'>): string => {
      const id = crypto.randomUUID();
      update((m) => {
        m.gates = m.gates ?? {};
        m.gates[id] = { ...data, id, kind: 'GATE' };
        m.updatedAt = Date.now();
      });
      return id;
    },

    updateGate: (id: string, patch: Partial<IRGate>) => {
      update((m) => {
        if (!m.gates?.[id]) return;
        m.gates[id] = { ...m.gates[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    deleteGate: (id: string) => {
      update((m) => {
        if (!m.gates?.[id]) return;
        delete m.gates[id];
        clearGateRefsOnMessagesLocal(m, new Set([id]));
        m.updatedAt = Date.now();
      });
    },

    // ── General Orderings (UML 2.5 §17.2) ─────────────────────────────────────

    createGeneralOrdering: (data: Omit<IRGeneralOrdering, 'id' | 'kind'>): string => {
      const id = crypto.randomUUID();
      update((m) => {
        m.generalOrderings = m.generalOrderings ?? {};
        m.generalOrderings[id] = { ...data, id, kind: 'GENERAL_ORDERING' };
        m.updatedAt = Date.now();
      });
      return id;
    },

    updateGeneralOrdering: (id: string, patch: Partial<IRGeneralOrdering>) => {
      update((m) => {
        if (!m.generalOrderings?.[id]) return;
        m.generalOrderings[id] = { ...m.generalOrderings[id], ...patch };
        m.updatedAt = Date.now();
      });
    },

    deleteGeneralOrdering: (id: string) => {
      update((m) => {
        if (!m.generalOrderings?.[id]) return;
        delete m.generalOrderings[id];
        m.updatedAt = Date.now();
      });
    },

    // ── Package names ─────────────────────────────────────────────────────────

    addPackageName: (name: string) => {
      update((m) => {
        if (!m.packageNames) m.packageNames = [];
        if (!m.packageNames.includes(name)) {
          m.packageNames.push(name);
        }
        m.updatedAt = Date.now();
      });
    },

    removePackageName: (name: string) => {
      update((m) => {
        if (!m.packageNames) return;
        m.packageNames = m.packageNames.filter((n) => n !== name);
        m.updatedAt = Date.now();
      });
    },

    setElementPackage: (elementId: string, packageName: string | undefined) => {
      update((m) => {
        // Auto-create intermediate packages if packageName contains dots
        if (packageName) {
          const hierarchy = getPackageHierarchy(packageName);
          if (!m.packageNames) m.packageNames = [];
          hierarchy.forEach(pkg => {
            if (m.packageNames && !m.packageNames.includes(pkg)) {
              m.packageNames.push(pkg);
            }
          });
        }
        
        if (m.classes[elementId]) {
          m.classes[elementId] = { ...m.classes[elementId], packageName };
        } else if (m.interfaces[elementId]) {
          m.interfaces[elementId] = { ...m.interfaces[elementId], packageName };
        } else if (m.enums[elementId]) {
          m.enums[elementId] = { ...m.enums[elementId], packageName };
        }
        m.updatedAt = Date.now();
      });
    },
  };
}
