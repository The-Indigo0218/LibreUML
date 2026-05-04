/**
 * useSpacePan — Space key state tracker
 *
 * Tracks Space key press/release state for use with other interactions:
 * - Space + right-click → lasso selection (handled by useSelection)
 *
 * Note: Space + left-click pan has been REMOVED. Use right-click pan instead.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface UseSpacePanOptions {
  /** Whether Space tracking is enabled (default: true) */
  enabled?: boolean;
}

export function useSpacePan(options: UseSpacePanOptions = {}) {
  const { enabled = true } = options;
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const isSpacePressedRef = useRef(false); // For event handlers

  // Handle Space key press
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if typing in input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Check for Space key (use code, not key, for keyboard compatibility)
      if (e.code === 'Space' && !isSpacePressedRef.current) {
        e.preventDefault(); // Prevent page scroll
        isSpacePressedRef.current = true;
        setIsSpacePressed(true);
      }
    },
    [enabled],
  );

  // Handle Space key release
  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      if (e.code === 'Space' && isSpacePressedRef.current) {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
      }
    },
    [enabled],
  );

  // Handle window blur (user switches window while holding Space)
  const handleBlur = useCallback(() => {
    if (isSpacePressedRef.current) {
      isSpacePressedRef.current = false;
      setIsSpacePressed(false);
    }
  }, []);

  // Register keyboard event listeners
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, handleKeyDown, handleKeyUp, handleBlur]);

  return {
    isSpacePressed,
    isSpacePressedRef,
  };
}
