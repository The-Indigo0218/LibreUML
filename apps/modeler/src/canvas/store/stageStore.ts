/**
 * stageStore — holds the active Konva Stage reference.
 *
 * KonvaCanvas registers the stage ref here after mount so that
 * export modals and other non-canvas components can access the stage
 * for capture operations (stage.toDataURL).
 */

import { create } from 'zustand';
import type Konva from 'konva';

interface StageStore {
  stage: Konva.Stage | null;
  setStage: (stage: Konva.Stage | null) => void;
}

export const useStageStore = create<StageStore>((set) => ({
  stage: null,
  setStage: (stage) => set({ stage }),
}));
