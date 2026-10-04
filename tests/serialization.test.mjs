import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../src/game/domain/state.ts';
import { canonicalJson } from '../src/game/domain/validation.ts';
import { deserializeCommand, deserializeEvent, deserializeState, isGameState, serializeCommand, serializeEvent, serializeState } from '../src/game/domain/serialization.ts';
import { SEED, command, copy, initial, initialized, known, player, players, ready, rules, step } from './fixtures/artificial-domain.mjs';

test('draft, locked handoff, ready and pending decision all roundtrip canonical version-1 JSON', () => {
  const r = rules(); const readyState = ready(r); const outcome = step(readyState, command(readyState, 'RollDice', player()), r);
  for (const state of [initial(r), initialized(r), readyState, outcome.state]) {
    assert.deepEqual(deserializeState(serializeState(state)), { ok: true, value: state });
    assert.equal(serializeState(deserializeState(serializeState(state)).value), serializeState(state));
  }
  assert.deepEqual(deserializeEvent(serializeEvent(outcome.events[0])), { ok: true, value: outcome.events[0] });
  assert.deepEqual(deserializeCommand(serializeCommand(outcome.events[0].command)), { ok: true, value: outcome.events[0].command });
});
test('serialization rejects unknown versions, omitted fields, extras, invalid JSON and invalid RNG state', () => {
  const r = rules(); const valid = ready(r);
  const mutations = [
    (s) => { s.schemaVersion = 2; }, (s) => { delete s.pendingDecision; }, (s) => { s.presentation = {}; },
    (s) => { s.ruleset.schemaVersion = 2; }, (s) => { s.economy.schemaVersion = 2; },
    (s) => { s.rng.algorithm = 'future-v2'; }, (s) => { s.rng.words = [0, 0, 0, 0]; },
    (s) => { s.revision = 1.5; }, (s) => { s.economy.accounts[0].balanceUnits = 0.5; },
    (s) => { s.players[0].position.locationId = 'absent-location'; },
    (s) => { s.economy.unit.unitsPerMajor = 1; }, (s) => { s.economy.negativeBalancePolicy.value = 'allow-negative'; },
    (s) => { s.turn.playerOrder = ['fixture-player-1', 'fixture-player-1']; },
  ];
  for (const mutate of mutations) { const state = copy(valid); mutate(state); assert.equal(deserializeState(JSON.stringify(state)).ok, false, JSON.stringify(state)); assert.throws(() => serializeState(state), TypeError); }
  for (const text of ['', '{', 'null', '[]', 'true']) assert.equal(deserializeState(text).ok, false);
});
test('handoff/cross-player invariants reject corruption without filling defaults', () => {
  const valid = initialized(rules());
  const mutations = [
    (s) => { s.handoff.inputLocked = false; }, (s) => { s.turn.ownerPlayerId = 'fixture-player-1'; },
    (s) => { s.handoff.incomingPlayerId = 'absent'; }, (s) => { s.handoff.incomingPlayerId = null; },
    (s) => { s.players[1].id = s.players[0].id; }, (s) => { s.economy.accounts.pop(); },
    (s) => { s.economy.accounts[0].playerId = 'absent'; }, (s) => { s.handoff.acknowledgementRequired = 'true'; },
  ];
  for (const mutate of mutations) { const state = copy(valid); mutate(state); assert.equal(isGameState(state), false); }
});
test('pinned ruleset signatures and contiguous unique command receipts are verified on restore', () => {
  const state = ready(rules());
  const mutations = [
    (s) => { s.ruleset.version = 'mismatch'; }, (s) => { s.rulesetSignature = '{}'; },
    (s) => { const pinned = JSON.parse(s.rulesetSignature); pinned.configuration.board.value.id = 'other'; s.rulesetSignature = canonicalJson(pinned); },
    (s) => { s.commandReceipts.pop(); }, (s) => { s.commandReceipts[0].revision = 2; },
    (s) => { s.commandReceipts[1].commandId = s.commandReceipts[0].commandId; },
    (s) => { s.commandReceipts[0].signature = '{}'; }, (s) => { s.commandReceipts[0].eventId = 'forged'; },
  ];
  for (const mutate of mutations) { const bad = copy(state); mutate(bad); assert.equal(deserializeState(JSON.stringify(bad)).ok, false); }
});
test('deck ownership/uniqueness and completion contracts are serializable without configuring physical content', () => {
  const r = rules({ cards: known(['a', 'b', 'c'].map((id) => ({ id: `test-card-${id}`, text: 'Synthetic schema-only content' }))), deckHandling: known('Synthetic deck contract; no actual draw/discard behaviour'), victory: known('Synthetic schema-only victory reference; no executable winner rules') });
  const state = ready(r);
  state.decks = [{ id: 'synthetic-deck', drawPile: ['test-card-a'], discardPile: ['test-card-b'], heldCards: [{ playerId: 'fixture-player-1', cardId: 'test-card-c' }] }];
  assert.equal(isGameState(state), true); assert.equal(deserializeState(serializeState(state)).ok, true);
  const repeated = copy(state); repeated.decks[0].drawPile.push('test-card-c'); assert.equal(isGameState(repeated), false);
  const absent = copy(state); absent.decks[0].heldCards[0].playerId = 'absent'; assert.equal(isGameState(absent), false);
  const winner = copy(state); winner.completion = { status: 'completed', winnerPlayerIds: ['fixture-player-1'], reference: 'Artificial schema-only completion; no engine victory rule' }; winner.handoff.inputLocked = true;
  assert.equal(isGameState(winner), true);
  winner.completion.winnerPlayerIds = ['absent']; assert.equal(isGameState(winner), false);
  assert.equal(initial(rules()).decks, null); // no synthetic production deck
});
test('pending decision must belong to owner and an originating event, not presentation state', () => {
  const r = rules(); const start = ready(r); const state = step(start, command(start, 'RollDice', player()), r).state;
  for (const mutate of [
    (s) => { s.pendingDecision.playerId = 'fixture-player-2'; }, (s) => { s.pendingDecision.originatingEventId = 'absent'; },
    (s) => { s.pendingDecision.id = 'not-derived-from-event'; }, (s) => { s.pendingDecision.faces = []; }, (s) => { s.pendingDecision.faces = [999, 1]; },
    (s) => { s.pendingDecision.originatingEventId = s.commandReceipts[0].eventId; s.pendingDecision.id = `${s.commandReceipts[0].eventId}:dice`; },
  ]) { const bad = copy(state); mutate(bad); assert.equal(isGameState(bad), false); }
});
test('malformed commands/events and non-JSON integers cannot pass encoding guards', () => {
  const r = rules(); const state = ready(r); const c = command(state, 'RollDice', player()); const event = step(state, c, r).events[0];
  for (const bad of [{ ...c, schemaVersion: 2 }, { ...c, extra: true }, { ...c, expectedRevision: NaN }]) { assert.equal(deserializeCommand(JSON.stringify(bad)).ok, false); assert.throws(() => serializeCommand(bad), TypeError); }
  for (const bad of [{ ...event, schemaVersion: 2 }, { ...event, faces: [1] }, { ...event, faces: [1.5, 2] }, { ...event, extra: true }, { ...event, rngAfter: { ...event.rngAfter, draws: -1 } }]) { assert.equal(deserializeEvent(JSON.stringify(bad)).ok, false); assert.throws(() => serializeEvent(bad), TypeError); }
  assert.equal(deserializeCommand('{').ok, false); assert.equal(deserializeEvent('{').ok, false);
});
test('factory rejects malformed rosters/identities/rulesets without manufacturing game configuration', () => {
  const r = rules();
  for (const roster of [[], [players()[0], players()[0]], [players()[0], , players()[1]], [{ ...players()[0], name: '' }], [{ ...players()[0], injected: true }]]) assert.throws(() => createGameState('fixture-match', roster, r, SEED), TypeError);
  assert.throws(() => createGameState('__proto__', players(), r, SEED), TypeError);
  assert.throws(() => createGameState('fixture-match', players(), { ...r, schemaVersion: 2 }, SEED), TypeError);
});

test('encoding rejects sparse lists and hidden/symbol/array metadata that JSON would silently discard', () => {
  for (const mutate of [
    (s) => { s[Symbol('unexpected')] = true; },
    (s) => { Object.defineProperty(s, 'unexpected', { value: true }); },
    (s) => { Object.defineProperty(s, 'schemaVersion', { enumerable: false }); },
    (s) => { s.players.extra = true; }, (s) => { delete s.players[0]; },
    (s) => { s.rng.words.extra = true; },
  ]) { const state = ready(rules()); mutate(state); assert.equal(isGameState(state), false); assert.throws(() => serializeState(state), TypeError); }
});

test('domain guards reject accessor properties without evaluating hidden code', () => {
  const r = rules(); const state = ready(r); let reads = 0;
  Object.defineProperty(state, 'revision', { enumerable: true, get() { reads++; return 2; } });
  assert.equal(isGameState(state), false); assert.equal(reads, 0);
  const arrayState = ready(r);
  Object.defineProperty(arrayState.players, '0', { enumerable: true, get() { reads++; return players()[0]; } });
  assert.equal(isGameState(arrayState), false); assert.equal(reads, 0);
});
