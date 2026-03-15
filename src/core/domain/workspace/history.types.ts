export interface HistorySnapshot {
  timestamp: number;
  nodes: any[];
  edges: any[];
}

export interface FileHistory {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  maxSize: number;
}

export const createEmptyHistory = (maxSize: number = 50): FileHistory => ({
  past: [],
  future: [],
  maxSize,
});

export const createSnapshot = (nodes: any[], edges: any[]): HistorySnapshot => ({
  timestamp: Date.now(),
  nodes: JSON.parse(JSON.stringify(nodes)),
  edges: JSON.parse(JSON.stringify(edges)),
});

export const pushSnapshot = (
  history: FileHistory,
  snapshot: HistorySnapshot
): FileHistory => {
  const newPast = [...history.past, snapshot];
  
  if (newPast.length > history.maxSize) {
    newPast.shift();
  }
  
  return {
    ...history,
    past: newPast,
    future: [],
  };
};

export const performUndo = (
  history: FileHistory,
  currentNodes: any[],
  currentEdges: any[]
): { history: FileHistory; snapshot: HistorySnapshot | null } => {
  if (history.past.length === 0) {
    return { history, snapshot: null };
  }
  
  const snapshot = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, -1);
  
  const currentSnapshot = createSnapshot(currentNodes, currentEdges);
  const newFuture = [currentSnapshot, ...history.future];
  
  return {
    history: {
      ...history,
      past: newPast,
      future: newFuture,
    },
    snapshot,
  };
};

export const performRedo = (
  history: FileHistory,
  currentNodes: any[],
  currentEdges: any[]
): { history: FileHistory; snapshot: HistorySnapshot | null } => {
  if (history.future.length === 0) {
    return { history, snapshot: null };
  }
  
  const snapshot = history.future[0];
  const newFuture = history.future.slice(1);
  
  const currentSnapshot = createSnapshot(currentNodes, currentEdges);
  const newPast = [...history.past, currentSnapshot];
  
  if (newPast.length > history.maxSize) {
    newPast.shift();
  }
  
  return {
    history: {
      ...history,
      past: newPast,
      future: newFuture,
    },
    snapshot,
  };
};

export const clearHistory = (history: FileHistory): FileHistory => ({
  ...history,
  past: [],
  future: [],
});

export const canUndo = (history: FileHistory): boolean => {
  return history.past.length > 0;
};

export const canRedo = (history: FileHistory): boolean => {
  return history.future.length > 0;
};
