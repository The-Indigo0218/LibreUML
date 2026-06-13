import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import ActivationShape from '../ActivationShape';
import type { ActivationViewModel } from '../../../adapters/view-models/node.view-model';

vi.mock('react-konva');

vi.mock('../../tokens/colors', () => ({
  resolveActivationColors: () => ({
    fill: '#eef2ff',
    border: '#4f46e5',
  }),
}));

function baseAct(overrides: Partial<ActivationViewModel> = {}): ActivationViewModel {
  return {
    __brand: 'activation',
    id: 'act1',
    domainId: 'act1',
    width: 10,
    height: 120,
    isOpen: false,
    nestingDepth: 0,
    ...overrides,
  };
}

describe('ActivationShape', () => {
  it('renders a closed activation bar', () => {
    const vm = baseAct();
    const { container } = render(<ActivationShape viewModel={vm} x={60} y={80} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders an open activation bar with dashed bottom', () => {
    const vm = baseAct({ isOpen: true });
    const { container } = render(<ActivationShape viewModel={vm} x={60} y={80} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a nested activation bar with offset', () => {
    const vm = baseAct({ nestingDepth: 1 });
    const { container } = render(<ActivationShape viewModel={vm} x={60} y={80} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a deeply nested activation bar', () => {
    const vm = baseAct({ nestingDepth: 2 });
    const { container } = render(<ActivationShape viewModel={vm} x={60} y={80} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders selected state with cyan outline', () => {
    const vm = baseAct();
    const { container } = render(<ActivationShape viewModel={vm} x={60} y={80} selected />);
    expect(container.firstChild).toMatchSnapshot();
  });

  // data-props is HTML-attribute encoded; getAttribute returns decoded JSON.
  const rectProps = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-konva="Rect"]')).map((el) =>
      JSON.parse(el.getAttribute('data-props') ?? '{}'),
    );

  it('highlights the bar with a cyan stroke when manually overridden (P3)', () => {
    const vm = baseAct({ isManual: true });
    const { container } = render(<ActivationShape viewModel={vm} x={60} y={80} />);
    const body = rectProps(container)[0];
    expect(body.stroke).toBe('#22d3ee');
    expect(body.strokeWidth).toBe(1.5);
  });

  it('renders a bottom resize handle only when onResizeEnd is provided (P3)', () => {
    const vm = baseAct();
    const withHandle = render(
      <ActivationShape viewModel={vm} x={60} y={80} onResizeEnd={() => {}} />,
    );
    const withoutHandle = render(<ActivationShape viewModel={vm} x={60} y={80} />);
    expect(rectProps(withHandle.container).some((p) => p.draggable === true)).toBe(true);
    expect(rectProps(withoutHandle.container).some((p) => p.draggable === true)).toBe(false);
  });
});
