/**
 * viewportControlStore — bridges KonvaCanvas viewport controls to menubar.
 *
 * KonvaCanvas registers its zoom/fit callbacks here on mount.
 * ViewMenu and useEditorControls read from here to trigger viewport changes
 * without needing direct component communication.
 */

import { create } from 'zustand';

interface ViewportControls {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
}

interface ViewportControlStore extends ViewportControls {
  register: (controls: ViewportControls) => void;
}

const noop = () => {};

export const useViewportControlStore = create<ViewportControlStore>((set) => ({
  zoomIn: noop,
  zoomOut: noop,
  fitView: noop,
  register: (controls) => set(controls),
}));
