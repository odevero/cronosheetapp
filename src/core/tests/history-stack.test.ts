import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearHistory,
  createHistoryState,
  mapHistoryEntries,
  peekRedo,
  peekUndo,
  popRedo,
  popUndo,
  pushHistory,
} from '../domain/services/history-stack';

interface MockCmd {
  readonly id: string;
  readonly label: string;
}

test('pushHistory, popUndo, and popRedo round-trip cleanly', () => {
  let state = createHistoryState<MockCmd>(10);
  assert.equal(peekUndo(state), null);
  assert.equal(peekRedo(state), null);

  state = pushHistory(state, { id: 'g1', label: 'Edit 1' });
  state = pushHistory(state, { id: 'g2', label: 'Edit 2' });
  assert.equal(state.past.length, 2);
  assert.equal(peekUndo(state)?.label, 'Edit 2');

  const u1 = popUndo(state);
  assert.equal(u1.entry?.label, 'Edit 2');
  state = u1.nextState;
  assert.equal(state.past.length, 1);
  assert.equal(state.future.length, 1);
  assert.equal(peekRedo(state)?.label, 'Edit 2');

  const r1 = popRedo(state);
  assert.equal(r1.entry?.label, 'Edit 2');
  state = r1.nextState;
  assert.equal(state.past.length, 2);
  assert.equal(state.future.length, 0);
});

test('pushHistory clears future redo entries after undo', () => {
  let state = createHistoryState<MockCmd>(10);
  state = pushHistory(state, { id: 'g1', label: 'A' });
  state = pushHistory(state, { id: 'g2', label: 'B' });
  state = popUndo(state).nextState;
  assert.equal(state.future.length, 1);

  state = pushHistory(state, { id: 'g3', label: 'C' });
  assert.equal(state.future.length, 0);
  assert.deepEqual(
    state.past.map((e) => e.label),
    ['A', 'C'],
  );
});

test('history enforces maxSize cap by dropping oldest entries', () => {
  let state = createHistoryState<MockCmd>(3);
  for (let i = 1; i <= 5; i++) {
    state = pushHistory(state, { id: `g${i}`, label: `E${i}` });
  }
  assert.equal(state.past.length, 3);
  assert.deepEqual(
    state.past.map((e) => e.label),
    ['E3', 'E4', 'E5'],
  );
});

test('mapHistoryEntries rewrites entity IDs across both past and future stacks', () => {
  let state = createHistoryState<MockCmd>(10);
  state = pushHistory(state, { id: 'old_1', label: 'Create' });
  state = pushHistory(state, { id: 'old_1', label: 'Edit' });
  state = popUndo(state).nextState;

  state = mapHistoryEntries(state, (e) =>
    e.id === 'old_1' ? { ...e, id: 'restored_1' } : e,
  );
  assert.equal(state.past[0].id, 'restored_1');
  assert.equal(state.future[0].id, 'restored_1');

  state = clearHistory(state);
  assert.equal(state.past.length, 0);
  assert.equal(state.future.length, 0);
});

test('popUndo and popRedo on empty stacks return null safely', () => {
  const empty = createHistoryState<MockCmd>();
  assert.equal(popUndo(empty).entry, null);
  assert.equal(popRedo(empty).entry, null);
});
