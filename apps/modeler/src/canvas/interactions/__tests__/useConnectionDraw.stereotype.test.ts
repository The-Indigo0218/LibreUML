import { describe, it, expect } from 'vitest';
import { SEQUENCE_STEREOTYPES, resolveStereotype, nodeAllowsSelfLoop } from '../useConnectionDraw';
import type {
  AnyNodeViewModel,
  LifelineViewModel,
  ActorViewModel,
  NoteViewModel,
  NodeViewModel,
  ActivityDecisionViewModel,
  ActivityForkJoinViewModel,
} from '../../../adapters/view-models/node.view-model';

function makeLifelineVM(): LifelineViewModel {
  return {
    __brand: 'lifeline',
    id: 'vm-ll',
    domainId: 'ir-ll',
    name: 'A',
    participantKind: 'ANONYMOUS',
    timelineLength: 200,
    headWidth: 140,
    headHeight: 50,
  };
}

function makeActorVM(): ActorViewModel {
  return {
    __brand: 'actor',
    id: 'vm-act',
    domainId: 'ir-act',
    name: 'User',
    isAbstract: false,
  };
}

function makeNoteVM(): NoteViewModel {
  return { id: 'vm-note', domainId: 'vm-note', content: 'hi' };
}

function makeDecisionVM(): ActivityDecisionViewModel {
  return { __brand: 'activityDecision', id: 'vm-dec', domainId: 'ir-dec', decisionKind: 'DECISION' };
}

function makeForkJoinVM(): ActivityForkJoinViewModel {
  return {
    __brand: 'activityForkJoin', id: 'vm-fork', domainId: 'ir-fork',
    forkJoinKind: 'FORK', barOrientation: 'HORIZONTAL',
  };
}

function makeClassVM(): NodeViewModel {
  return {
    id: 'vm-c',
    domainId: 'ir-c',
    label: 'Foo',
    sections: [],
    style: {
      containerClass: '',
      headerClass: '',
      badgeColor: '',
      labelFormat: '',
      showStereotype: false,
    },
  };
}

describe('resolveStereotype', () => {
  it('returns "lifeline" for LifelineViewModel', () => {
    expect(resolveStereotype(makeLifelineVM() as AnyNodeViewModel)).toBe('lifeline');
  });

  it('still returns "actor" for ActorViewModel', () => {
    expect(resolveStereotype(makeActorVM() as AnyNodeViewModel)).toBe('actor');
  });

  it('returns "note" for NoteViewModel', () => {
    expect(resolveStereotype(makeNoteVM() as AnyNodeViewModel)).toBe('note');
  });

  it('returns "class" for a default NodeViewModel without explicit stereotype', () => {
    expect(resolveStereotype(makeClassVM() as AnyNodeViewModel)).toBe('class');
  });

  // A2.5 — decision/merge and fork/join fell through to the "class" default,
  // so a flow drawn to/from one of them was validated as a class relation
  // (and usually rejected) instead of deferring to the activity registry.
  it('returns "activity_node" for ActivityDecisionViewModel, not "class"', () => {
    expect(resolveStereotype(makeDecisionVM() as AnyNodeViewModel)).toBe('activity_node');
  });

  it('returns "activity_node" for ActivityForkJoinViewModel, not "class"', () => {
    expect(resolveStereotype(makeForkJoinVM() as AnyNodeViewModel)).toBe('activity_node');
  });
});

describe('SEQUENCE_STEREOTYPES', () => {
  it('contains "lifeline" so the connection dispatcher delegates to onConnect', () => {
    expect(SEQUENCE_STEREOTYPES.has('lifeline')).toBe(true);
  });

  it('does NOT contain class-diagram stereotypes', () => {
    expect(SEQUENCE_STEREOTYPES.has('class')).toBe(false);
    expect(SEQUENCE_STEREOTYPES.has('interface')).toBe(false);
    expect(SEQUENCE_STEREOTYPES.has('actor')).toBe(false);
  });
});

describe('nodeAllowsSelfLoop', () => {
  it('returns false for lifelines (self-message uses the context-menu action, not a manual loop)', () => {
    expect(nodeAllowsSelfLoop(makeLifelineVM() as AnyNodeViewModel)).toBe(false);
  });

  it('returns false for actors (no self-loop semantics in use-case)', () => {
    expect(nodeAllowsSelfLoop(makeActorVM() as AnyNodeViewModel)).toBe(false);
  });

  it('returns false for class nodes (avoid accidental self-association)', () => {
    expect(nodeAllowsSelfLoop(makeClassVM() as AnyNodeViewModel)).toBe(false);
  });

  it('returns false for undefined (defensive guard)', () => {
    expect(nodeAllowsSelfLoop(undefined)).toBe(false);
  });
});
