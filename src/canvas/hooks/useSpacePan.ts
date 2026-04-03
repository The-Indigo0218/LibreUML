/**
 * useSpacePan — Space + drag pan mode (MAG-01.25)
 *
 * Implements industry-standard pan interaction:
 * - Press Space → cursor = "grab", enable stage dragging
 * - Space + drag → cursor = "grabbing", pan canvas
 * - Release Space → cursor = normal, disable stage dragging
 * - Normal drag (no Space) → select/move nodes
 *
 * Matches UX from Miro, Figma, FigJam, Excalidraw.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type Konva from 'konva';

export interface UseSpacePanOptions {
  /** Stage ref to control draggable state */
  stageRef: React.RefObject<Konva.Stage>;
  /** Container ref to change cursor style */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Whether pan mode is enabled (default: true) */
  enabled?: boolean;
}

export function useSpacePan(options: UseSpacePanOptions) {
  const { stageRef, containerRef, enabled = true } = options;
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isSpacePressedRef = useRef(false); // For event handlers

  // Update cursor based on state
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    if (isSpacePressed && isDragging) {
      container.style.cursor = 'grabbing';
    } else if (isSpacePressed) {
      container.style.cursor = 'grab';
    } else {
      container.style.cursor = 'default';
    }
  }, [isSpacePressed, isDragging, containerRef, enabled]);

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

        // Enable stage dragging
        const stage = stageRef.current;
        if (stage) {
          stage.draggable(true);
        }
      }
    },
    [enabled, stageRef],
  );

  // Handle Space key release
  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      if (e.code === 'Space' && isSpacePressedRef.current) {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
        setIsDragging(false);

        // Disable stage dragging
        const stage = stageRef.current;
        if (stage) {
          stage.draggable(false);
        }
      }
    },
    [enabled, stageRef],
  );

  // Handle window blur (user switches window while holding Space)
  const handleBlur = useCallback(() => {
    if (isSpacePressedRef.current) {
      isSpacePressedRef.current = false;
      setIsSpacePressed(false);
      setIsDragging(false);

      // Disable stage dragging
      const stage = stageRef.current;
      if (stage) {
        stage.draggable(false);
      }
    }
  }, [stageRef]);

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

  // Stage drag handlers to track dragging state
  const onStageDragStart = useCallback(() => {
    if (isSpacePressedRef.current) {
      setIsDragging(true);
    }
  }, []);

  const onStageDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return {
    isSpacePressed,
    isDragging,
    onStageDragStart,
    onStageDragEnd,
  };
}
