import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_NODE_KINDS, getNodeKind, type NodeKind } from '../../adapters/view-models/node-kind';
import { NODE_KIND_DESCRIPTORS } from '../nodeKindDescriptors';
import { renderShape } from '../ShapeRouter';
import ClassShape from '../shapes/ClassShape';
import NoteShape from '../shapes/NoteShape';
import ActorShape from '../shapes/ActorShape';
import UseCaseShape from '../shapes/UseCaseShape';
import SystemBoundaryShape from '../shapes/SystemBoundaryShape';
import UCModuleShape from '../shapes/UCModuleShape';
import DomainEntityShape from '../shapes/DomainEntityShape';
import LifelineShape from '../shapes/LifelineShape';
import MessageShape from '../shapes/MessageShape';
import ActivationShape from '../shapes/ActivationShape';
import FragmentShape from '../shapes/FragmentShape';
import StateInvariantShape from '../shapes/StateInvariantShape';
import InteractionUseShape from '../shapes/InteractionUseShape';
import GateShape from '../shapes/GateShape';
import GeneralOrderingShape from '../shapes/GeneralOrderingShape';
import TimeConstraintShape from '../shapes/TimeConstraintShape';
import CoregionShape from '../shapes/CoregionShape';
import ContinuationShape from '../shapes/ContinuationShape';
import ActionShape from '../shapes/ActionShape';
import ControlNodeShape from '../shapes/ControlNodeShape';
import DecisionShape from '../shapes/DecisionShape';
import ForkJoinShape from '../shapes/ForkJoinShape';

/**
 * A0 (ADR-0009). The descriptor table is the canvas' extension point for node
 * kinds: a kind missing from it does not fail loudly, it silently renders as a
 * class box. These tests make that failure mode impossible to reach by
 * accident.
 */
describe('NODE_KIND_DESCRIPTORS', () => {
  it('has an entry for every node kind', () => {
    const missing = ALL_NODE_KINDS.filter((kind) => !(kind in NODE_KIND_DESCRIPTORS));
    expect(missing).toEqual([]);
  });

  it('has no entry that is not a known node kind', () => {
    const known = new Set<string>(ALL_NODE_KINDS);
    const stray = Object.keys(NODE_KIND_DESCRIPTORS).filter((key) => !known.has(key));
    expect(stray).toEqual([]);
  });

  it('gives every kind a renderer and a sizer, except the package', () => {
    for (const kind of ALL_NODE_KINDS) {
      const descriptor = NODE_KIND_DESCRIPTORS[kind];
      if (kind === 'package') {
        // The package sizes itself from its children and draws in the
        // background layer; it deliberately opts out of the ShapeRouter path.
        expect(descriptor.size).toBeNull();
        expect(descriptor.render).toBeNull();
        continue;
      }
      expect(descriptor.size, `${kind} has no size`).toBeTypeOf('function');
      expect(descriptor.render, `${kind} has no render`).toBeTypeOf('function');
    }
  });

  /**
   * `ALL_NODE_KINDS` is hand-maintained, so it could itself drift from the
   * `NodeKind` union. This ties it back to the source of truth: every
   * `__brand` declared on a view model must appear as a kind.
   */
  it('covers every __brand declared in node.view-model.ts', () => {
    const source = readFileSync(
      join(__dirname, '../../adapters/view-models/node.view-model.ts'),
      'utf8',
    );
    const brands = [...source.matchAll(/__brand: '([a-zA-Z]+)'/g)].map((m) => m[1]);

    expect(brands.length).toBeGreaterThan(0);
    const known = new Set<string>(ALL_NODE_KINDS);
    expect(brands.filter((brand) => !known.has(brand))).toEqual([]);
  });
});

/**
 * Exhaustiveness alone does not prove the table is wired to anything: an entry
 * could point at the wrong component and every test above would still pass.
 * These assert the routing itself, which is what the old if-chain guaranteed
 * positionally.
 */
describe('renderShape routing', () => {
  const EXPECTED: Partial<Record<NodeKind, unknown>> = {
    class: ClassShape,
    note: NoteShape,
    actor: ActorShape,
    useCase: UseCaseShape,
    systemBoundary: SystemBoundaryShape,
    ucModule: UCModuleShape,
    domainEntity: DomainEntityShape,
    lifeline: LifelineShape,
    message: MessageShape,
    activation: ActivationShape,
    fragment: FragmentShape,
    stateInvariant: StateInvariantShape,
    interactionUse: InteractionUseShape,
    gate: GateShape,
    generalOrdering: GeneralOrderingShape,
    timeConstraint: TimeConstraintShape,
    coregion: CoregionShape,
    continuation: ContinuationShape,
    activityAction: ActionShape,
    activityControlNode: ControlNodeShape,
    activityDecision: DecisionShape,
    activityForkJoin: ForkJoinShape,
  };

  /** Minimal view model that resolves to `kind` — see `getNodeKind`. */
  function stubFor(kind: NodeKind) {
    if (kind === 'class') return { sections: [] };
    if (kind === 'note') return { content: '' };
    return { __brand: kind };
  }

  const props = { key: 'n1', x: 0, y: 0 };

  it.each(Object.keys(EXPECTED) as NodeKind[])('routes %s to its own shape', (kind) => {
    const element = renderShape(stubFor(kind) as never, props as never);
    expect((element as { type: unknown }).type).toBe(EXPECTED[kind]);
  });

  it('falls back to the class box for a view model of no known kind', () => {
    const element = renderShape({ id: 'x' } as never, props as never);
    expect((element as { type: unknown }).type).toBe(ClassShape);
  });

  it('falls back to the class box for the package, which draws in its own layer', () => {
    const element = renderShape({ __brand: 'package' } as never, props as never);
    expect((element as { type: unknown }).type).toBe(ClassShape);
  });
});

/**
 * A0 is a characterization phase: the behaviour below is what the ternary
 * chains in `KonvaCanvas` did before the table existed, transcribed one by one.
 * It is deliberately a locked matrix — if a future change alters what a kind
 * can do, that should be a visible edit here and not a silent drift.
 */
describe('node kind behaviour matrix', () => {
  const EXPECTED: Record<
    NodeKind,
    { draggable: boolean; dragAxis: string; dragEnd: string; resize: string }
  > = {
    class: { draggable: true, dragAxis: 'free', dragEnd: 'node', resize: 'systemBoundary' },
    note: { draggable: true, dragAxis: 'free', dragEnd: 'node', resize: 'note' },
    package: { draggable: true, dragAxis: 'free', dragEnd: 'node', resize: 'package' },
    actor: { draggable: true, dragAxis: 'free', dragEnd: 'node', resize: 'systemBoundary' },
    useCase: { draggable: true, dragAxis: 'free', dragEnd: 'node', resize: 'systemBoundary' },
    systemBoundary: { draggable: true, dragAxis: 'free', dragEnd: 'node', resize: 'systemBoundary' },
    ucModule: { draggable: true, dragAxis: 'free', dragEnd: 'node', resize: 'ucModule' },
    domainEntity: { draggable: true, dragAxis: 'free', dragEnd: 'node', resize: 'systemBoundary' },
    lifeline: {
      draggable: true,
      dragAxis: 'horizontal',
      dragEnd: 'node',
      resize: 'lifelineTimeline',
    },
    message: { draggable: true, dragAxis: 'vertical', dragEnd: 'message', resize: 'systemBoundary' },
    activation: { draggable: false, dragAxis: 'free', dragEnd: 'node', resize: 'systemBoundary' },
    fragment: { draggable: true, dragAxis: 'vertical', dragEnd: 'fragment', resize: 'fragment' },
    stateInvariant: {
      draggable: true,
      dragAxis: 'vertical',
      dragEnd: 'derived',
      resize: 'stateInvariant',
    },
    interactionUse: {
      draggable: true,
      dragAxis: 'vertical',
      dragEnd: 'derived',
      resize: 'interactionUse',
    },
    gate: { draggable: true, dragAxis: 'vertical', dragEnd: 'derived', resize: 'systemBoundary' },
    generalOrdering: {
      draggable: false,
      dragAxis: 'free',
      dragEnd: 'node',
      resize: 'systemBoundary',
    },
    timeConstraint: {
      draggable: false,
      dragAxis: 'free',
      dragEnd: 'node',
      resize: 'systemBoundary',
    },
    coregion: { draggable: false, dragAxis: 'free', dragEnd: 'node', resize: 'systemBoundary' },
    continuation: {
      draggable: true,
      dragAxis: 'vertical',
      dragEnd: 'derived',
      resize: 'systemBoundary',
    },
    // Activity nodes have free geometry, like class boxes: nothing about them
    // is derived, so nothing is axis-locked.
    activityAction: {
      draggable: true,
      dragAxis: 'free',
      dragEnd: 'node',
      resize: 'systemBoundary',
    },
    activityControlNode: {
      draggable: true,
      dragAxis: 'free',
      dragEnd: 'node',
      resize: 'systemBoundary',
    },
    // A2: decision/merge (rhombus) and fork/join (bar) — same free geometry
    // as every other activity node, no label to derive anything from.
    activityDecision: {
      draggable: true,
      dragAxis: 'free',
      dragEnd: 'node',
      resize: 'systemBoundary',
    },
    activityForkJoin: {
      draggable: true,
      dragAxis: 'free',
      dragEnd: 'node',
      resize: 'systemBoundary',
    },
  };

  it.each(ALL_NODE_KINDS)('%s behaves as it did before the table', (kind) => {
    const { draggable, dragAxis, dragEnd, resize } = NODE_KIND_DESCRIPTORS[kind];
    expect({ draggable, dragAxis, dragEnd, resize }).toEqual(EXPECTED[kind]);
  });

  it('leaves geometry that the system owns undraggable', () => {
    // Activations follow their message; general orderings, timing constraints
    // and coregions are anchored to occurrences.
    const undraggable = ALL_NODE_KINDS.filter((k) => !NODE_KIND_DESCRIPTORS[k].draggable);
    expect(undraggable.sort()).toEqual(
      ['activation', 'coregion', 'generalOrdering', 'timeConstraint'].sort(),
    );
  });

  it('gives an action an inline rename and a control node no editor at all', () => {
    expect(NODE_KIND_DESCRIPTORS.activityAction.editor).toBe('inlineRename');
    // A filled circle has nothing to edit.
    expect(NODE_KIND_DESCRIPTORS.activityControlNode.editor).toBe('none');
  });

  it('offers the timeline reset only on the lifeline', () => {
    const withReset = ALL_NODE_KINDS.filter((k) => NODE_KIND_DESCRIPTORS[k].resetTimeline);
    expect(withReset).toEqual(['lifeline']);
  });

  it('gives every kind a distinct editor except the ones that defer to onOpenProps', () => {
    const editors = ALL_NODE_KINDS.map((k) => NODE_KIND_DESCRIPTORS[k].editor);
    const deferring = ALL_NODE_KINDS.filter(
      (k) => NODE_KIND_DESCRIPTORS[k].editor === 'openProps',
    );
    expect(deferring.sort()).toEqual(
      ['actor', 'activation', 'domainEntity', 'systemBoundary', 'ucModule'].sort(),
    );
    expect(editors).toHaveLength(ALL_NODE_KINDS.length);
  });
});

describe('getNodeKind', () => {
  it('reads the brand when the view model has one', () => {
    expect(getNodeKind({ __brand: 'lifeline' } as never)).toBe<NodeKind>('lifeline');
    expect(getNodeKind({ __brand: 'generalOrdering' } as never)).toBe<NodeKind>('generalOrdering');
  });

  it('falls back to structure for the two unbranded view models', () => {
    // The class node and the note predate `__brand` and are still told apart
    // by shape — `sections` for the class, `content` for the note.
    expect(getNodeKind({ sections: [] } as never)).toBe<NodeKind>('class');
    expect(getNodeKind({ content: 'a note' } as never)).toBe<NodeKind>('note');
  });

  it('prefers `sections` over `content` when both are present', () => {
    expect(getNodeKind({ sections: [], content: 'x' } as never)).toBe<NodeKind>('class');
  });

  it('returns null for a view model it cannot place', () => {
    expect(getNodeKind({ id: 'x' } as never)).toBeNull();
  });
});
