import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import MessageShape from '../MessageShape';
import type { MessageViewModel } from '../../../adapters/view-models/node.view-model';

vi.mock('react-konva');

vi.mock('../../tokens/colors', () => ({
  resolveMessageColors: () => ({
    stroke: '#1e293b',
    text: '#1e293b',
    fill: '#1e293b',
  }),
}));

function baseMsg(overrides: Partial<MessageViewModel> = {}): MessageViewModel {
  return {
    __brand: 'message',
    id: 'm1',
    domainId: 'm1',
    name: 'doSomething',
    messageKind: 'SYNC',
    sequenceNumber: 1,
    displayNumber: '1',
    length: 200,
    isSelfMessage: false,
    ...overrides,
  };
}

describe('MessageShape', () => {
  it('renders a SYNC message (solid line, closed head)', () => {
    const vm = baseMsg();
    const { container } = render(<MessageShape viewModel={vm} x={120} y={100} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders an ASYNC message (solid line, open head)', () => {
    const vm = baseMsg({ messageKind: 'ASYNC', name: 'notify' });
    const { container } = render(<MessageShape viewModel={vm} x={120} y={100} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a REPLY message (dashed line, open head)', () => {
    const vm = baseMsg({ messageKind: 'REPLY', name: 'result', length: -200 });
    const { container } = render(<MessageShape viewModel={vm} x={250} y={100} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a CREATE message (dashed line, open head)', () => {
    const vm = baseMsg({ messageKind: 'CREATE', name: 'new' });
    const { container } = render(<MessageShape viewModel={vm} x={120} y={100} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a self-message loop', () => {
    const vm = baseMsg({ isSelfMessage: true, length: 0 });
    const { container } = render(<MessageShape viewModel={vm} x={200} y={100} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a self REPLY message (dashed loop)', () => {
    const vm = baseMsg({ messageKind: 'REPLY', isSelfMessage: true, length: 0 });
    const { container } = render(<MessageShape viewModel={vm} x={200} y={100} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a found message with filled circle at source', () => {
    const vm = baseMsg({ isFound: true });
    const { container } = render(<MessageShape viewModel={vm} x={120} y={100} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a lost message with filled circle at target', () => {
    const vm = baseMsg({ isLost: true });
    const { container } = render(<MessageShape viewModel={vm} x={120} y={100} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders selected state with cyan outline', () => {
    const vm = baseMsg();
    const { container } = render(<MessageShape viewModel={vm} x={120} y={100} selected />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders a message with empty name (just sequence number)', () => {
    const vm = baseMsg({ name: '' });
    const { container } = render(<MessageShape viewModel={vm} x={120} y={100} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  // C8 — message-level guard rendered as [guard] before the name.
  const labelTextOf = (container: HTMLElement): string =>
    Array.from(container.querySelectorAll('[data-konva="Text"]'))
      .map((el) => (JSON.parse(el.getAttribute('data-props') ?? '{}') as { text?: string }).text ?? '')
      .find((t) => t.includes(':')) ?? '';

  it('prefixes the label with [guard] when a guard is set', () => {
    const vm = baseMsg({ guard: 'balance > 0' });
    const { container } = render(<MessageShape viewModel={vm} x={120} y={100} />);
    expect(labelTextOf(container)).toBe('1: [balance > 0] doSomething');
  });

  it('shows just the guard when the message has no name', () => {
    const vm = baseMsg({ name: '', guard: 'ok' });
    const { container } = render(<MessageShape viewModel={vm} x={120} y={100} />);
    expect(labelTextOf(container)).toBe('1: [ok]');
  });

  it('omits the brackets when no guard is set', () => {
    const vm = baseMsg();
    const { container } = render(<MessageShape viewModel={vm} x={120} y={100} />);
    expect(labelTextOf(container)).toBe('1: doSomething');
  });
});
