export const canvasConfig = {
  gridColor: "var(--color-canvas-dots, #475569)", 
  gridOpacity: 0.6,
};

export const miniMapColors = {
  note: "var(--color-uml-note-border, #38BDF8)",
  interface: "var(--color-uml-interface-border, #22D3EE)",
  abstract: "var(--color-uml-abstract-border, #60A5FA)",
  class: "var(--color-uml-class-border, #7C83FF)",
};


const PALETTE = {
  base: "var(--edge-base)",
  inheritance: "var(--edge-inheritance)",
  implementation: "var(--edge-implementation)",
  dependency: "var(--edge-dependency)",
  association: "var(--edge-association)",
  note: "var(--edge-note)",
  arrowHead: "var(--arrow-head)",
};

export const edgeConfig = {
  base: {
    type: "smoothstep",
    animated: false,
    pathOptions: { borderRadius: 20 },
    style: { stroke: PALETTE.base },
  },
  types: {
    inheritance: {
      style: { strokeWidth: 2.5, stroke: PALETTE.base }, 
      marker: { color: PALETTE.arrowHead, width: 25, height: 25 },
      zIndex: 10,
      highlight: PALETTE.inheritance 
    },
    implementation: {
      style: { strokeWidth: 2, strokeDasharray: "6,4", stroke: PALETTE.base },
      marker: { color: PALETTE.arrowHead, width: 25, height: 25 },
      zIndex: 9,
      highlight: PALETTE.implementation
    },
    dependency: {
      style: { strokeWidth: 1, strokeDasharray: "4,4", stroke: PALETTE.base },
      marker: { color: PALETTE.base, width: 18, height: 18 },
      zIndex: 1,
      highlight: PALETTE.dependency
    },
    association: {
      style: { strokeWidth: 1.5, stroke: PALETTE.base },
      marker: { color: PALETTE.base, width: 20, height: 20 },
      zIndex: 5,
      highlight: PALETTE.association
    },
    note: {
      style: { strokeWidth: 1, strokeDasharray: "3,3", stroke: PALETTE.base },
      marker: { color: PALETTE.base, width: 15, height: 15 },
      zIndex: 1,
      highlight: PALETTE.note
    },
  },
};

export const NODE_WIDTH = 250;
export const NODE_HEIGHT = 200;