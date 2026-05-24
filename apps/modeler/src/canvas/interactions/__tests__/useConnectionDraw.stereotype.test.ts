import { describe, it, expect } from 'vitest';
import { SEQUENCE_STEREOTYPES, resolveStereotype } from '../useConnectionDraw';
import type {
  AnyNodeViewModel,
  LifelineViewModel,
  ActorViewModel,
  NoteViewModel,
  NodeViewModel,
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
