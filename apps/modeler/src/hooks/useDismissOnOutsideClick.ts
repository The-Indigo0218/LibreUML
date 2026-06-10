import { useEffect, useRef } from 'react';

interface Options {
  /** When false, the listener is not attached (panel stays open). Defaults to true. */
  enabled?: boolean;
}

/**
 * Dismiss a floating panel/popover when the user presses down outside of it.
 *
 * Returns a ref to attach to the panel's root element. A `mousedown` anywhere
 * outside that element (and outside any element marked `data-dismiss-ignore`,
 * for portaled sub-popovers like color pickers) invokes `onDismiss`.
 *
 * Notes:
 *  - Uses `mousedown` (not `click`) so it fires before the canvas processes its
 *    own selection click — they don't fight: an inside press is ignored via the
 *    `contains` check, an outside press closes the panel while the canvas does
 *    its normal (de)selection.
 *  - The listener is attached on the next frame so the very interaction that
 *    opened the panel can't immediately close it.
 *  - `onDismiss` is kept in a ref, so passing an inline arrow is fine — the
 *    listener isn't re-attached on every render.
 */
export function useDismissOnOutsideClick<T extends HTMLElement = HTMLElement>(
  onDismiss: () => void,
  { enabled = true }: Options = {},
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (e: MouseEvent) => {
      const el = ref.current;
      const target = e.target as Node | null;
      if (!el || !target) return;
      if (el.contains(target)) return; // press inside the panel
      if (target instanceof Element && target.closest('[data-dismiss-ignore]')) return;
      onDismissRef.current();
    };

    const raf = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handlePointerDown);
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [enabled]);

  return ref;
}
