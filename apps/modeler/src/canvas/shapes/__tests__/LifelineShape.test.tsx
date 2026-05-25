import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import LifelineShape from '../LifelineShape';
import type { LifelineViewModel } from '../../../adapters/view-models/node.view-model';

vi.mock('react-konva');

vi.mock('../../tokens/colors', () => ({
  resolveLifelineColors: () => ({
    headBg: '#eef2ff',
    border: '#4f46e5',
    text: '#1e293b',
    timeline: '#94a3b8',
  }),
}));

function baseLL(overrides: Partial<LifelineViewModel> = {}): LifelineViewModel {
  return {
    __brand: 'lifeline',
    id: 'll1',
    domainId: 'll1',
    name: 'User',
    participantKind: 'ANONYMOUS',
    timelineLength: 400,
    headWidth: 120,
    headHeight: 40,
    ...overrides,
  };
}

describe('LifelineShape', () => {
  it('renders a basic anonymous lifeline', () => {
    const vm = baseLL();
    const { container } = render(<LifelineShape viewModel={vm} x={50} y={0} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a lifeline with actor stereotype', () => {
    const vm = baseLL({ participantKind: 'ACTOR', name: 'Admin' });
    const { container } = render(<LifelineShape viewModel={vm} x={100} y={0} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a lifeline with interface stereotype', () => {
    const vm = baseLL({ participantKind: 'INTERFACE', name: 'IAuth' });
    const { container } = render(<LifelineShape viewModel={vm} x={100} y={0} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a lifeline with object stereotype', () => {
    const vm = baseLL({ participantKind: 'OBJECT', name: 'instance' });
    const { container } = render(<LifelineShape viewModel={vm} x={100} y={0} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a lifeline with a CLASS participant (no stereotype)', () => {
    const vm = baseLL({ participantKind: 'CLASS', name: 'UserService' });
    const { container } = render(<LifelineShape viewModel={vm} x={100} y={0} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a destroyed lifeline with ✕ marker', () => {
    const vm = baseLL({ isDestroyed: true });
    const { container } = render(<LifelineShape viewModel={vm} x={50} y={0} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a lifeline with a headTopOffset (CREATE event)', () => {
    const vm = baseLL({ headTopOffset: 80 });
    const { container } = render(<LifelineShape viewModel={vm} x={50} y={0} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders selected state with cyan outline', () => {
    const vm = baseLL();
    const { container } = render(<LifelineShape viewModel={vm} x={50} y={0} selected />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
