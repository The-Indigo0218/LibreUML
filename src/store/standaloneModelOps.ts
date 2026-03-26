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
  IRRelation,
  IRAttribute,
  IROperation,
} from '../core/domain/vfs/vfs.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cascadeDeleteRelations(model: SemanticModel, elementId: string) {
  for (const rid of Object.keys(model.relations)) {
    const rel = model.relations[rid];
    if (rel.sourceId === elementId || rel.targetId === elementId) {
      delete model.relations[rid];
    }
  }
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
      update((m) => { m.classes[id] = { ...data, id, kind: 'CLASS' }; m.updatedAt = Date.now(); });
      return id;
    },

    createAbstractClass: (data: Omit<IRClass, 'id' | 'kind' | 'isAbstract'>): string => {
      const id = crypto.randomUUID();
      update((m) => { m.classes[id] = { ...data, id, kind: 'CLASS', isAbstract: true }; m.updatedAt = Date.now(); });
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
      update((m) => { m.interfaces[id] = { ...data, id, kind: 'INTERFACE' }; m.updatedAt = Date.now(); });
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
      update((m) => { m.enums[id] = { ...data, id, kind: 'ENUM' }; m.updatedAt = Date.now(); });
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
          iface.operationIds.forEach((oid) => { delete m.operations[oid]; });
          operations.forEach((o) => { m.operations[o.id] = o; });
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
