/**
 * Activity Diagram XMI 2.1 / UML 2.5.1 exporter (A5, ADR-0011).
 *
 * Maps the diagram to a single `uml:Activity` packagedElement containing:
 *  - uml:OpaqueAction / uml:CallOperationAction (action nodes; the latter's
 *    `operation` attribute only when callsOperationId resolves in the model)
 *  - uml:InitialNode / uml:ActivityFinalNode / uml:FlowFinalNode
 *  - uml:DecisionNode / uml:MergeNode / uml:ForkNode / uml:JoinNode
 *  - uml:ObjectNode (v1.1), `type` referencing its classifier trace (A6,
 *    ADR-0010) when it resolves
 *  - uml:ExpansionRegion / uml:ExpansionNode (v1.1), the latter's `type`
 *    traced the same way as an object node's classifier
 *  - uml:ControlFlow / uml:ObjectFlow, with guard → OpaqueExpression and
 *    weight → LiteralString children (C8-style: metamodel fields, not folded
 *    into the name — unlike sequence's per-message guard, ActivityEdge.guard
 *    has a real home)
 *  - uml:ActivityPartition (`represents` only when representsId resolves)
 *  - uml:Realization (Activity → UseCase) when realizesUseCaseId resolves
 *
 * Fidelity contract (spec §14.3, D6): this is conformance/archive output, not
 * a round-trip promise. A trace (`callsOperationId`, `realizesUseCaseId`,
 * `representsId`) is only emitted as an `xmi:idref` when the target still
 * resolves in the model — a dangling trace is silently omitted rather than
 * emitting a reference nothing in this document (or the receiving tool)
 * could ever resolve. Positions/sizes are never emitted; they live in `.luml`.
 *
 * Only elements whose owning Activity is present in the DiagramView are
 * exported (same in-scope convention as `buildSequenceDiagramXmi`).
 */

import type {
  SemanticModel,
  DiagramView,
  IRActivity,
  IRActivityNode,
  IRActivityPartition,
  IRRelation,
  ActivityNodeKind,
} from '../core/domain/vfs/vfs.types';
import { esc, xmiId, xmiHeader, xmiFooter, downloadXml } from './xmi/xmiHelpers';

/** Activity node kind → UML 2.5.1 metaclass (spec §14.3). */
const NODE_METACLASS: Record<ActivityNodeKind, string> = {
  ACTION: 'uml:OpaqueAction',
  CALL_OPERATION: 'uml:CallOperationAction',
  INITIAL: 'uml:InitialNode',
  ACTIVITY_FINAL: 'uml:ActivityFinalNode',
  DECISION: 'uml:DecisionNode',
  MERGE: 'uml:MergeNode',
  FORK: 'uml:ForkNode',
  JOIN: 'uml:JoinNode',
  FLOW_FINAL: 'uml:FlowFinalNode',
  OBJECT_NODE: 'uml:ObjectNode',
  // Pins (A6.2): exported flat like every other node here, not nested under
  // their owning action's `input`/`output` — same conformance/archival
  // scope cut as the rest of this file (spec §14.3, D6).
  INPUT_PIN: 'uml:InputPin',
  OUTPUT_PIN: 'uml:OutputPin',
  // Structured nodes (v1.1): same flat scope cut — a real StructuredActivityNode
  // contains its body as owned nodes/edges, which this exporter's flat <node>
  // list does not model for anything (spec §14.3, D6).
  LOOP_NODE: 'uml:LoopNode',
  CONDITIONAL_NODE: 'uml:ConditionalNode',
  SEQUENCE_NODE: 'uml:SequenceNode',
  // InterruptibleActivityRegion (v1.1): real UML models this as an
  // ActivityGroup, not an ActivityNode — exported flat here alongside the
  // rest anyway, same conformance/archival scope cut as everything else in
  // this file (spec §14.3, D6).
  INTERRUPTIBLE_REGION: 'uml:InterruptibleActivityRegion',
  // ExpansionRegion (v1.1): a real StructuredActivityNode subtype in UML —
  // unlike INTERRUPTIBLE_REGION above, no classification cut here, only the
  // usual flat-body one every kind in this exporter already takes.
  EXPANSION_REGION: 'uml:ExpansionRegion',
  // Real UML has one metaclass for both directions (`uml:ExpansionNode`),
  // distinguished by which collection it belongs to
  // (`inputElement`/`outputElement` on the region), not by subclassing —
  // both map to it here, direction is conveyed by the domain-node type only.
  INPUT_EXPANSION_NODE: 'uml:ExpansionNode',
  OUTPUT_EXPANSION_NODE: 'uml:ExpansionNode',
};

/** Node types whose `classifierId` trace is emitted as ObjectNode.type (A6.1/v1.1). */
const CLASSIFIER_TRACED_TYPES = new Set<ActivityNodeKind>([
  'OBJECT_NODE', 'INPUT_EXPANSION_NODE', 'OUTPUT_EXPANSION_NODE',
]);

/** Resolves an id against every classifier/actor collection a `represents` trace can point to. */
function representsName(model: SemanticModel, id: string): string | undefined {
  return (
    model.classes[id]?.name ??
    model.interfaces[id]?.name ??
    model.actors?.[id]?.name
  );
}

/** Resolves an id against every classifier collection an object node's `classifierId` can point to. */
function classifierName(model: SemanticModel, id: string): string | undefined {
  return (
    model.classes[id]?.name ??
    model.interfaces[id]?.name ??
    model.enums[id]?.name ??
    model.dataTypes[id]?.name
  );
}

function serializeNode(node: IRActivityNode, model: SemanticModel): string {
  const xmiType = NODE_METACLASS[node.activityType];
  const attrs = [
    `xmi:type="${xmiType}"`,
    `xmi:id="${xmiId(node.id)}"`,
    node.name ? `name="${esc(node.name)}"` : '',
  ];

  // CALL_OPERATION: only reference the operation when it still resolves —
  // a dangling callsOperationId is omitted, never emitted as a broken idref.
  if (node.activityType === 'CALL_OPERATION' && node.callsOperationId) {
    if (model.operations?.[node.callsOperationId]) {
      attrs.push(`operation="${xmiId(node.callsOperationId)}"`);
    }
  }

  // OBJECT_NODE, or an expansion node (v1.1): `type` references the
  // classifier of the value/element in flow (UML 2.5.1 ObjectNode.type,
  // which ExpansionNode inherits), same dangling-trace rule as CALL_OPERATION.
  if (CLASSIFIER_TRACED_TYPES.has(node.activityType) && node.classifierId) {
    if (classifierName(model, node.classifierId) !== undefined) {
      attrs.push(`type="${xmiId(node.classifierId)}"`);
    }
  }

  // EXPANSION_REGION: mode (UML 2.5.1 ExpansionRegion.mode, ExpansionKind
  // literals are lowercase) — always emitted, defaulting the same way the
  // model does when unset.
  if (node.activityType === 'EXPANSION_REGION') {
    attrs.push(`mode="${(node.mode ?? 'PARALLEL').toLowerCase()}"`);
  }

  return `    <node ${attrs.filter(Boolean).join(' ')}/>`;
}

function serializePartition(partition: IRActivityPartition, model: SemanticModel): string {
  const attrs = [
    `xmi:type="uml:ActivityPartition"`,
    `xmi:id="${xmiId(partition.id)}"`,
    `name="${esc(partition.name || '')}"`,
  ];
  if (partition.representsId) {
    const name = representsName(model, partition.representsId);
    if (name !== undefined) attrs.push(`represents="${xmiId(partition.representsId)}"`);
  }
  return `    <partition ${attrs.join(' ')}/>`;
}

/**
 * Resolves the INTERRUPTIBLE_REGION a flow's `isInterrupting` flag refers to
 * (its source's `containerId`) — omitted, like every other trace in this
 * file, when it doesn't resolve (spec §14.3, D6). Real UML's
 * `ActivityEdge.interrupts` is an association to the region; folded here
 * into a plain `interrupts` idref attribute on the `<edge>`.
 */
function resolveInterruptsRegionId(
  rel: IRRelation,
  nodesById: Map<string, IRActivityNode>,
): string | undefined {
  const source = nodesById.get(rel.sourceId);
  const region = source?.containerId ? nodesById.get(source.containerId) : undefined;
  return region?.activityType === 'INTERRUPTIBLE_REGION' ? region.id : undefined;
}

function serializeFlow(rel: IRRelation, nodesById: Map<string, IRActivityNode>): string {
  const xmiType = rel.kind === 'OBJECT_FLOW' ? 'uml:ObjectFlow' : 'uml:ControlFlow';
  const attrs = [
    `xmi:type="${xmiType}"`,
    `xmi:id="${xmiId(rel.id)}"`,
    `source="${xmiId(rel.sourceId)}"`,
    `target="${xmiId(rel.targetId)}"`,
  ];

  if (rel.isInterrupting) {
    const regionId = resolveInterruptsRegionId(rel, nodesById);
    if (regionId) attrs.push(`interrupts="${xmiId(regionId)}"`);
  }

  const attrsStr = attrs.join(' ');
  const guard = rel.guard?.trim();
  const weight = rel.weight?.trim();
  if (!guard && !weight) return `    <edge ${attrsStr}/>`;

  const lines = [`    <edge ${attrsStr}>`];
  if (guard) {
    lines.push(
      `      <guard xmi:type="uml:OpaqueExpression" xmi:id="${xmiId(rel.id)}_guard">`,
      `        <body>${esc(guard)}</body>`,
      `      </guard>`,
    );
  }
  if (weight) {
    lines.push(
      `      <weight xmi:type="uml:LiteralString" xmi:id="${xmiId(rel.id)}_weight" value="${esc(weight)}"/>`,
    );
  }
  lines.push(`    </edge>`);
  return lines.join('\n');
}

/**
 * Protected node → handler action (v1.1). Collapsed to a flat `<edge>`, same
 * scope cut as pins not nesting under `Action.input`/`Action.output` — real
 * UML's `ExceptionHandler` is an owned element of the protected node, not a
 * top-level edge, and has no `exceptionInput` here (spec §14.3, D6). Both
 * endpoints always resolve — an EXCEPTION_HANDLER relation cannot exist with
 * either endpoint missing — so there is no skip case to guard here.
 */
function serializeExceptionHandler(rel: IRRelation): string {
  return `    <edge xmi:type="uml:ExceptionHandler" xmi:id="${xmiId(rel.id)}" protectedNode="${xmiId(rel.sourceId)}" handlerBody="${xmiId(rel.targetId)}"/>`;
}

/** Activity → UseCase realization (D4/ADR-0010) — omitted when the trace dangles. */
function serializeRealization(activity: IRActivity, model: SemanticModel): string | null {
  if (!activity.realizesUseCaseId) return null;
  const uc = model.useCases?.[activity.realizesUseCaseId];
  if (!uc) return null;
  return `  <packagedElement xmi:type="uml:Realization" xmi:id="realization_${xmiId(activity.id)}" client="${xmiId(activity.id)}" supplier="${xmiId(uc.id)}"/>`;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function buildActivityDiagramXmi(
  model: SemanticModel,
  diagramView: DiagramView | null,
  diagramName: string,
): string {
  // In-scope = elements the diagram actually draws (or everything, headless export).
  const viewElementIds = diagramView
    ? new Set(diagramView.nodes.map((vn) => vn.elementId).filter(Boolean))
    : null;
  const inScope = (id: string) => (!viewElementIds || viewElementIds.has(id));

  const nodes = Object.values(model.activityNodes ?? {}).filter((n) => inScope(n.id));
  const partitions = Object.values(model.activityPartitions ?? {}).filter((p) => inScope(p.id));

  const activityIds = new Set<string>([
    ...nodes.map((n) => n.activityId),
    ...partitions.map((p) => p.activityId),
  ]);
  // Exactly one Activity per file in v1 (getOrCreateActivityId), but fall
  // back gracefully to "no activity yet" instead of assuming index 0.
  const activity: IRActivity | undefined =
    activityIds.size > 0 ? model.activities?.[[...activityIds][0]] : undefined;

  const nodeIds = new Set(nodes.map((n) => n.id));
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const flows = Object.values(model.relations ?? {}).filter(
    (r) =>
      (r.kind === 'CONTROL_FLOW' || r.kind === 'OBJECT_FLOW') &&
      nodeIds.has(r.sourceId) &&
      nodeIds.has(r.targetId),
  );
  const exceptionHandlers = Object.values(model.relations ?? {}).filter(
    (r) => r.kind === 'EXCEPTION_HANDLER' && nodeIds.has(r.sourceId) && nodeIds.has(r.targetId),
  );

  const activityName = activity?.name || diagramName;
  const activityId = activity?.id ?? `activity_${xmiId(model.id)}`;

  const lines: string[] = xmiHeader(model.id, diagramName);
  lines.push(
    `  <packagedElement xmi:type="uml:Activity" xmi:id="${xmiId(activityId)}" name="${esc(activityName)}">`,
  );

  for (const p of partitions) lines.push(serializePartition(p, model));
  for (const n of nodes) lines.push(serializeNode(n, model));
  for (const f of flows) lines.push(serializeFlow(f, nodesById));
  for (const h of exceptionHandlers) lines.push(serializeExceptionHandler(h));

  lines.push(`  </packagedElement>`);

  if (activity) {
    const realization = serializeRealization(activity, model);
    if (realization) lines.push(realization);
  }

  lines.push(...xmiFooter());

  return lines.join('\n');
}

export function downloadActivityDiagramXmi(
  model: SemanticModel,
  diagramView: DiagramView | null,
  diagramName: string,
): void {
  downloadXml(buildActivityDiagramXmi(model, diagramView, diagramName), diagramName);
}
