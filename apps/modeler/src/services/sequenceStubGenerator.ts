/**
 * Sequence-diagram code stub generation.
 *
 * Derives operation stubs on the classifiers that lifelines represent from the
 * SYNC/ASYNC messages targeting them: a call `target.foo(args)` implies the
 * target's classifier owns an operation `foo`. The derived operations flow into
 * the existing Java/codegen pipeline like any hand-authored member.
 *
 * Pure derivation (`deriveOperationStubs`) is separated from the store write
 * (`applyOperationStubs`) so it can be unit-tested without the stores.
 */

import type {
  SemanticModel,
  DiagramView,
  IROperation,
  IRParameter,
  IRAttribute,
} from '../core/domain/vfs/vfs.types';

export interface StubPlan {
  classifierId: string;
  classifierName: string;
  /** New operations to append (none already present on the classifier). */
  operations: IROperation[];
}

/** Parse a free-form argument string ("id, name: String") into parameters. */
function parseArgs(args?: string): IRParameter[] {
  if (!args) return [];
  return args
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((tok, i) => {
      const colon = tok.indexOf(':');
      if (colon > 0) {
        return {
          name: tok.slice(0, colon).trim() || `arg${i}`,
          type: tok.slice(colon + 1).trim() || 'Object',
        };
      }
      return { name: tok, type: 'Object' };
    });
}

/**
 * Returns the operation stubs implied by a sequence diagram's messages,
 * grouped per target classifier. Skips: non-call messages (reply/create/
 * destroy/found/lost), unnamed messages, messages already linked to an
 * operation, and names the classifier already declares.
 */
export function deriveOperationStubs(
  model: SemanticModel,
  diagramView: DiagramView | null,
): StubPlan[] {
  const viewLifelineIds = diagramView
    ? new Set(diagramView.nodes.map((n) => n.elementId).filter(Boolean))
    : null;
  const inScope = (id: string) => !viewLifelineIds || viewLifelineIds.has(id);

  const byClassifier = new Map<
    string,
    { name: string; ops: IROperation[]; names: Set<string> }
  >();

  const messages = Object.values(model.messages ?? {}).sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber,
  );

  for (const msg of messages) {
    if (msg.messageKind !== 'SYNC' && msg.messageKind !== 'ASYNC') continue;
    if (msg.isFound || msg.isLost) continue; // unknown endpoints have no classifier
    if (msg.operationId) continue;            // already linked to a real operation
    const name = (msg.name ?? '').trim();
    if (!name) continue;
    if (!msg.targetLifelineId || !inScope(msg.targetLifelineId)) continue;

    const lifeline = model.lifelines?.[msg.targetLifelineId];
    if (!lifeline?.represents) continue;

    const owner = model.classes[lifeline.represents] ?? model.interfaces[lifeline.represents];
    if (!owner) continue;

    if (!byClassifier.has(owner.id)) {
      const names = new Set<string>();
      (owner.operationIds ?? []).forEach((oid) => {
        const op = model.operations[oid];
        if (op) names.add(op.name);
      });
      byClassifier.set(owner.id, { name: owner.name, ops: [], names });
    }

    const bucket = byClassifier.get(owner.id)!;
    if (bucket.names.has(name)) continue; // already declared (existing or earlier in this batch)
    bucket.names.add(name);
    bucket.ops.push({
      id: crypto.randomUUID(),
      kind: 'OPERATION',
      name,
      visibility: 'public',
      returnType: 'void',
      parameters: parseArgs(msg.arguments),
    });
  }

  return [...byClassifier.entries()]
    .filter(([, b]) => b.ops.length > 0)
    .map(([id, b]) => ({ classifierId: id, classifierName: b.name, operations: b.ops }));
}

/**
 * Writes the derived stubs into the model via `setElementMembers`, appending to
 * each classifier's existing members. Returns the number of operations added.
 */
export function applyOperationStubs(
  model: SemanticModel,
  plans: StubPlan[],
  setElementMembers: (id: string, attributes: IRAttribute[], operations: IROperation[]) => void,
): number {
  let added = 0;
  for (const plan of plans) {
    const cls = model.classes[plan.classifierId];
    const iface = model.interfaces[plan.classifierId];
    const owner = cls ?? iface;
    if (!owner) continue;

    const attrIds = cls ? cls.attributeIds : (iface?.attributeIds ?? []);
    const currentAttrs = attrIds
      .map((id) => model.attributes[id])
      .filter((a): a is IRAttribute => !!a);
    const currentOps = (owner.operationIds ?? [])
      .map((id) => model.operations[id])
      .filter((o): o is IROperation => !!o);

    setElementMembers(plan.classifierId, currentAttrs, [...currentOps, ...plan.operations]);
    added += plan.operations.length;
  }
  return added;
}
