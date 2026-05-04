// Test environment bootstrap. Mirrors the side-effecting imports in main.tsx
// that production code relies on but tests skip by importing modules directly.
import { enablePatches } from 'immer';
enablePatches();

// Register the undo bridge so that store mutations using `withUndo` actually run.
import './core/undo/instance';
