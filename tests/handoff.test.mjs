import assert from 'node:assert/strict';
import test from 'node:test';
import { deserializeState, serializeState } from '../src/game/domain/serialization.ts';
import { command, initialized, player, ready, rejected, rules, step, system, transaction } from './fixtures/artificial-domain.mjs';

test('first Ready handoff starts locked with no completed player or turn owner', () => {
  const r = rules(); const state = initialized(r);
  assert.deepEqual(state.handoff, { completedPlayerId: null, incomingPlayerId: 'fixture-player-1', acknowledgementRequired: true, inputLocked: true });
  assert.equal(state.turn.ownerPlayerId, null); assert.equal(state.turn.completedTurns, 0);
  rejected(state, command(state, 'RollDice', player()), r, 'INPUT_LOCKED');
  rejected(state, command(state, 'AcknowledgeHandoff', player('fixture-player-2')), r, 'WRONG_INCOMING_PLAYER');
  rejected(state, command(state, 'AcknowledgeHandoff', system), r, 'WRONG_INCOMING_PLAYER');
  rejected(state, command(state, 'PrepareHandoff', system, { nextPlayerId: 'fixture-player-2' }), r, 'HANDOFF_PENDING');
});
test('incoming acknowledgement alone unlocks turn ownership and duplicate Ready is unavailable', () => {
  const r = rules(); const state = initialized(r); const readyState = step(state, command(state, 'AcknowledgeHandoff', player()), r).state;
  assert.equal(readyState.handoff.inputLocked, false); assert.equal(readyState.handoff.acknowledgementRequired, false);
  assert.equal(readyState.turn.ownerPlayerId, 'fixture-player-1'); assert.deepEqual(readyState.rng, state.rng);
  rejected(readyState, command(readyState, 'AcknowledgeHandoff', player()), r, 'NO_HANDOFF_PENDING');
  rejected(readyState, command(readyState, 'RollDice', player('fixture-player-2')), r, 'NOT_TURN_OWNER');
});
test('explicit turn handoff records completed/incoming players and survives serialized recovery', () => {
  const r = rules(); const state = ready(r);
  rejected(state, command(state, 'PrepareHandoff', player(), { nextPlayerId: 'fixture-player-2' }), r, 'INVALID_ACTOR');
  rejected(state, command(state, 'PrepareHandoff', system, { nextPlayerId: 'absent' }), r, 'INVALID_ACTOR');
  const handed = step(state, command(state, 'PrepareHandoff', system, { nextPlayerId: 'fixture-player-2' }), r).state;
  const restored = deserializeState(serializeState(handed)); assert.equal(restored.ok, true); assert.deepEqual(restored.value, handed);
  assert.deepEqual(handed.handoff, { completedPlayerId: 'fixture-player-1', incomingPlayerId: 'fixture-player-2', acknowledgementRequired: true, inputLocked: true });
  assert.equal(handed.turn.ownerPlayerId, null); assert.equal(handed.turn.completedTurns, 1);
  for (const actor of [player(), player('fixture-player-2')]) rejected(restored.value, command(restored.value, 'RollDice', actor), r, 'INPUT_LOCKED');
  const transfer = transaction('transfer', { fromPlayerId: 'fixture-player-1', toPlayerId: 'fixture-player-2' }, player());
  rejected(restored.value, command(restored.value, 'PostTransaction', player(), { transaction: transfer }), r, 'INPUT_LOCKED');
  rejected(restored.value, command(restored.value, 'AcknowledgeHandoff', player()), r, 'WRONG_INCOMING_PLAYER');
  const incoming = step(restored.value, command(restored.value, 'AcknowledgeHandoff', player('fixture-player-2')), r).state;
  assert.equal(incoming.turn.ownerPlayerId, 'fixture-player-2'); assert.equal(incoming.handoff.inputLocked, false);
  assert.equal(incoming.handoff.completedPlayerId, 'fixture-player-1');
});
test('unresolved recorded outcome blocks player commands and turn completion instead of inventing resolution', () => {
  const r = rules(); const state = ready(r); const rolled = step(state, command(state, 'RollDice', player()), r).state;
  const restored = deserializeState(serializeState(rolled)).value;
  rejected(restored, command(restored, 'RollDice', player()), r, 'DECISION_PENDING');
  rejected(restored, command(restored, 'PrepareHandoff', system, { nextPlayerId: 'fixture-player-2' }), r, 'DECISION_PENDING');
  const transfer = transaction('transfer', { fromPlayerId: 'fixture-player-1', toPlayerId: 'fixture-player-2' }, player());
  rejected(restored, command(restored, 'PostTransaction', player(), { transaction: transfer }), r, 'DECISION_PENDING');
  assert.equal(restored.players[0].position.locationId, 'fixture-A'); assert.equal(restored.players[0].status, null);
});
test('trusted system transaction during handoff does not implicitly unlock gameplay input', () => {
  const r = rules(); const state = initialized(r); const input = transaction('credit', { toPlayerId: 'fixture-player-1' });
  const resolved = step(state, command(state, 'PostTransaction', system, { transaction: input }), r);
  assert.deepEqual(resolved.state.handoff, state.handoff); assert.equal(resolved.state.turn.ownerPlayerId, null);
  assert.deepEqual(resolved.state.rng, state.rng);
});
