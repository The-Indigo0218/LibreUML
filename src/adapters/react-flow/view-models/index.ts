export * from './node-view.types';
export * from './edge-view.types';

import type { NodeView } from './node-view.types';
import type { EdgeView } from './edge-view.types';

/**
 * Complete view state for a diagram (what React Flow renders)
 */
export interface DiagramViewState {
  nodes: NodeView[];
  edges: EdgeView[];
}
