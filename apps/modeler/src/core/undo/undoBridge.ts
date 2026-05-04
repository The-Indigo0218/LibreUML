import type { TransactionSpec } from './undoTransaction';
import type { StoreKey } from './types';
import type { UndoManager } from './UndoManager';

type WithUndoFn = (
  store: StoreKey,
  label: string,
  scope: string,
  mutate: (draft: any) => void,
) => void;
type UndoTransactionFn = (spec: TransactionSpec) => void;

let _manager: UndoManager | null = null;
let _withUndo: WithUndoFn | null = null;
let _undoTransaction: UndoTransactionFn | null = null;

export function _registerUndoBridge(
  manager: UndoManager,
  withUndoFn: WithUndoFn,
  undoTransactionFn: UndoTransactionFn,
): void {
  _manager = manager;
  _withUndo = withUndoFn;
  _undoTransaction = undoTransactionFn;
}

export function withUndo(
  store: StoreKey,
  label: string,
  scope: string,
  mutate: (draft: any) => void,
): void {
  _withUndo?.(store, label, scope, mutate);
}

export function undoTransaction(spec: TransactionSpec): void {
  _undoTransaction?.(spec);
}

export function getUndoManager(): UndoManager | null {
  return _manager;
}
