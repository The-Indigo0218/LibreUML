/**
 * usePerformanceMonitor — FPS tracking and render timing (MAG-01.13)
 *
 * Tracks frames-per-second via requestAnimationFrame.
 * Enable/disable with the returned start/stop functions.
 * FPS is logged to console and returned as reactive state.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface PerformanceStats {
  fps: number;
  frameTime: number; // ms per frame
}

export function usePerformanceMonitor(enabled = false) {
  const [stats, setStats] = useState<PerformanceStats>({ fps: 0, frameTime: 0 });
  const [isRunning, setIsRunning] = useState(enabled);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);

  const loop = useCallback((now: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = now;
      lastFpsUpdateRef.current = now;
    }

    frameCountRef.current += 1;
    const elapsed = now - lastFpsUpdateRef.current;

    if (elapsed >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / elapsed);
      const frameTime = elapsed / frameCountRef.current;
      setStats({ fps, frameTime: Math.round(frameTime * 100) / 100 });
      console.debug(`[PerfMonitor] FPS: ${fps} | Frame: ${frameTime.toFixed(2)}ms`);
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }

    lastTimeRef.current = now;
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    lastTimeRef.current = 0;
    frameCountRef.current = 0;
    lastFpsUpdateRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRunning, loop]);

  const start = useCallback(() => setIsRunning(true), []);
  const stop = useCallback(() => setIsRunning(false), []);

  return { stats, isRunning, start, stop };
}
