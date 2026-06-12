import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { useDismissOnOutsideClick } from '../useDismissOnOutsideClick';

// Make the rAF-deferred listener attach synchronously so tests are deterministic.
beforeEach(() => {
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Panel({ onClose, enabled }: { onClose: () => void; enabled?: boolean }) {
  const ref = useDismissOnOutsideClick<HTMLDivElement>(onClose, { enabled });
  return (
    <div>
      <div ref={ref} data-testid="panel">
        <button data-testid="inside-btn">inside</button>
      </div>
      <div data-testid="outside">outside</div>
      <div data-dismiss-ignore data-testid="ignored">portaled popover</div>
    </div>
  );
}

describe('useDismissOnOutsideClick', () => {
  it('dismisses on mousedown outside the panel', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Panel onClose={onClose} />);
    fireEvent.mouseDown(getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss on mousedown inside the panel', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Panel onClose={onClose} />);
    fireEvent.mouseDown(getByTestId('inside-btn'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not dismiss when pressing an element marked data-dismiss-ignore', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Panel onClose={onClose} />);
    fireEvent.mouseDown(getByTestId('ignored'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Panel onClose={onClose} enabled={false} />);
    fireEvent.mouseDown(getByTestId('outside'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('detaches the listener on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<Panel onClose={onClose} />);
    unmount();
    fireEvent.mouseDown(document.body);
    expect(onClose).not.toHaveBeenCalled();
  });
});
