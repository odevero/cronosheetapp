/**
 * Pure, immutable Undo/Redo history stack (Clean Architecture — Domain Layer).
 * Zero framework or storage dependencies; fully testable via node:test.
 */

export interface HistoryState<T> {
  readonly past: readonly T[];
  readonly future: readonly T[];
  readonly maxSize: number;
}

export const DEFAULT_HISTORY_LIMIT = 50;

export function createHistoryState<T>(maxSize = DEFAULT_HISTORY_LIMIT): HistoryState<T> {
  const safeMax = Number.isFinite(maxSize) && maxSize >= 1 ? Math.floor(maxSize) : DEFAULT_HISTORY_LIMIT;
  return {
    past: [],
    future: [],
    maxSize: safeMax,
  };
}

export function pushHistory<T>(state: HistoryState<T>, entry: T): HistoryState<T> {
  const nextPast = [...state.past, entry];
  const trimmedPast =
    nextPast.length > state.maxSize ? nextPast.slice(nextPast.length - state.maxSize) : nextPast;
  return {
    past: trimmedPast,
    future: [],
    maxSize: state.maxSize,
  };
}

export function popUndo<T>(state: HistoryState<T>): {
  readonly entry: T | null;
  readonly nextState: HistoryState<T>;
} {
  if (state.past.length === 0) {
    return { entry: null, nextState: state };
  }
  const entry = state.past[state.past.length - 1];
  const nextPast = state.past.slice(0, -1);
  const nextFuture = [entry, ...state.future].slice(0, state.maxSize);
  return {
    entry,
    nextState: {
      past: nextPast,
      future: nextFuture,
      maxSize: state.maxSize,
    },
  };
}

export function popRedo<T>(state: HistoryState<T>): {
  readonly entry: T | null;
  readonly nextState: HistoryState<T>;
} {
  if (state.future.length === 0) {
    return { entry: null, nextState: state };
  }
  const entry = state.future[0];
  const nextFuture = state.future.slice(1);
  const nextPast = [...state.past, entry];
  const trimmedPast =
    nextPast.length > state.maxSize ? nextPast.slice(nextPast.length - state.maxSize) : nextPast;
  return {
    entry,
    nextState: {
      past: trimmedPast,
      future: nextFuture,
      maxSize: state.maxSize,
    },
  };
}

export function peekUndo<T>(state: HistoryState<T>): T | null {
  return state.past.length > 0 ? state.past[state.past.length - 1] : null;
}

export function peekRedo<T>(state: HistoryState<T>): T | null {
  return state.future.length > 0 ? state.future[0] : null;
}

export function mapHistoryEntries<T>(
  state: HistoryState<T>,
  mapper: (entry: T) => T,
): HistoryState<T> {
  return {
    past: state.past.map(mapper),
    future: state.future.map(mapper),
    maxSize: state.maxSize,
  };
}

export function clearHistory<T>(state: HistoryState<T>): HistoryState<T> {
  return {
    past: [],
    future: [],
    maxSize: state.maxSize,
  };
}
