import { describe, it, expect, vi } from 'vitest';

vi.mock('react-konva');
vi.mock('../measureText', () => ({
  measureTextWidth: (t: string) => t.length * 7,
}));
vi.mock('../tokens/colors', () => ({
  resolveDomainEntityColors: () => ({ bg: '', headerBg: '', border: '', text: '', textMuted: '' }),
  resolveUseCaseColors: () => ({ fill: '', stroke: '', text: '' }),
  resolveActorColors: () => ({ fill: '', stroke: '', text: '' }),
  resolveNoteColors: () => ({ bg: '', surfacePrimary: '', border: '', textMuted: '' }),
}));

import { getDomainEntityShapeSize } from '../DomainEntityShape';
import { getUseCaseShapeSize } from '../UseCaseShape';
import { getActorShapeSize } from '../ActorShape';
import { getNoteShapeSize } from '../NoteShape';
import type {
  DomainEntityViewModel, UseCaseViewModel, ActorViewModel, NoteViewModel,
} from '../../../adapters/view-models/node.view-model';

const domain = (over: Partial<DomainEntityViewModel> = {}): DomainEntityViewModel => ({
  __brand: 'domainEntity', id: 'd', domainId: 'd', name: 'Order',
  attributes: [{ id: 'a', name: 'total' }], ...over,
});
const useCase = (over: Partial<UseCaseViewModel> = {}): UseCaseViewModel => ({
  __brand: 'useCase', id: 'u', domainId: 'u', name: 'Checkout',
  extensionPoints: ['payment'], hasSpec: false, ...over,
});
const actor = (over: Partial<ActorViewModel> = {}): ActorViewModel => ({
  __brand: 'actor', id: 'ac', domainId: 'ac', name: 'Customer', isAbstract: false, ...over,
});
const note = (over: Partial<NoteViewModel> = {}): NoteViewModel => ({
  id: 'n', domainId: 'n', title: 'Note', content: 'a remark', ...over,
});

describe('font reflow grows non-class shapes', () => {
  it('domain entity grows taller with a larger font size', () => {
    expect(getDomainEntityShapeSize(domain({ fontSizeOverride: 28 })).height)
      .toBeGreaterThan(getDomainEntityShapeSize(domain()).height);
  });

  it('use case grows taller with a larger font size', () => {
    expect(getUseCaseShapeSize(useCase({ fontSizeOverride: 26 })).height)
      .toBeGreaterThan(getUseCaseShapeSize(useCase()).height);
  });

  it('actor grows taller with a larger font size', () => {
    expect(getActorShapeSize(actor({ fontSizeOverride: 26 })).height)
      .toBeGreaterThan(getActorShapeSize(actor()).height);
  });

  it('note grows taller with a larger font size', () => {
    expect(getNoteShapeSize(note({ fontSizeOverride: 28 })).height)
      .toBeGreaterThan(getNoteShapeSize(note()).height);
  });
});
