import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import FragmentShape from '../FragmentShape';
import type { FragmentViewModel } from '../../../adapters/view-models/node.view-model';

vi.mock('react-konva');

vi.mock('../../tokens/colors', () => ({
  resolveFragmentColors: () => ({
    border: '#818cf8',
    labelBg: '#312e81',
    labelText: '#e0e7ff',
    guardText: '#94a3b8',
    separator: '#64748b',
  }),
}));

function baseFrag(overrides: Partial<FragmentViewModel> = {}): FragmentViewModel {
  return {
    __brand: 'fragment',
    id: 'fr1',
    domainId: 'fr1',
    fragmentKind: 'ALT',
    width: 300,
    height: 180,
    operands: [
      { id: 'op1', guard: 'x > 0', yOffset: 0 },
      { id: 'op2', guard: 'else', yOffset: 100 },
    ],
    nestingDepth: 0,
    ...overrides,
  };
}

describe('FragmentShape', () => {
  it('renders an ALT fragment with two operands and guards', () => {
    const vm = baseFrag();
    const { container } = render(<FragmentShape viewModel={vm} x={40} y={60} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders an OPT fragment with a single operand and guard', () => {
    const vm = baseFrag({
      fragmentKind: 'OPT',
      operands: [{ id: 'op1', guard: 'isReady', yOffset: 0 }],
    });
    const { container } = render(<FragmentShape viewModel={vm} x={40} y={60} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a LOOP fragment with no guard (warning expected)', () => {
    const vm = baseFrag({
      fragmentKind: 'LOOP',
      operands: [{ id: 'op1', guard: undefined, yOffset: 0 }],
    });
    const { container } = render(<FragmentShape viewModel={vm} x={40} y={60} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a nested fragment with depth offset', () => {
    const vm = baseFrag({ nestingDepth: 1 });
    const { container } = render(<FragmentShape viewModel={vm} x={40} y={60} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a fragment with a single operand and no guard', () => {
    const vm = baseFrag({
      operands: [{ id: 'op1', guard: undefined, yOffset: 0 }],
    });
    const { container } = render(<FragmentShape viewModel={vm} x={40} y={60} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders selected state with cyan outline', () => {
    const vm = baseFrag();
    const { container } = render(<FragmentShape viewModel={vm} x={40} y={60} selected />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
