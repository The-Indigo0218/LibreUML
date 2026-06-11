import { describe, it, expect } from 'vitest';
import { shouldFloat } from '../geometry';

describe('shouldFloat — floating-anchor gate', () => {
  it('never floats self-loops, regardless of diagram', () => {
    expect(shouldFloat({ isUseCaseDiagram: true, isSelfLoop: true })).toBe(false);
    expect(
      shouldFloat({ isUseCaseDiagram: false, isSelfLoop: true, routingMode: 'straight' }),
    ).toBe(false);
  });

  it('never floats explicitly locked edges', () => {
    expect(
      shouldFloat({ isUseCaseDiagram: true, isSelfLoop: false, anchorLocked: true }),
    ).toBe(false);
    expect(
      shouldFloat({
        isUseCaseDiagram: false,
        isSelfLoop: false,
        anchorLocked: true,
        routingMode: 'straight',
      }),
    ).toBe(false);
  });

  it('always floats UseCase edges that are not locked / self-loops', () => {
    // Even with no routing mode (legacy → orthogonal) UseCase keeps floating.
    expect(shouldFloat({ isUseCaseDiagram: true, isSelfLoop: false })).toBe(true);
    expect(
      shouldFloat({ isUseCaseDiagram: true, isSelfLoop: false, routingMode: 'orthogonal' }),
    ).toBe(true);
  });

  it('floats straight edges in non-UseCase diagrams', () => {
    expect(
      shouldFloat({ isUseCaseDiagram: false, isSelfLoop: false, routingMode: 'straight' }),
    ).toBe(true);
  });

  it('does NOT float curved edges (floating body would flatten the curve)', () => {
    expect(
      shouldFloat({ isUseCaseDiagram: false, isSelfLoop: false, routingMode: 'curved' }),
    ).toBe(false);
  });

  it('does NOT float legacy orthogonal edges (undefined routing) outside UseCase', () => {
    expect(shouldFloat({ isUseCaseDiagram: false, isSelfLoop: false })).toBe(false);
    expect(
      shouldFloat({ isUseCaseDiagram: false, isSelfLoop: false, routingMode: 'orthogonal' }),
    ).toBe(false);
  });
});
