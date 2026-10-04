import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createOneChanceDraft } from '../src/game/content/oneChanceDraft.ts';
import { validateRuleset } from '../src/game/content/ruleset.ts';
import { createGameState } from '../src/game/domain/state.ts';
import { deserializeState, serializeState, serializeEvent, deserializeEvent } from '../src/game/domain/serialization.ts';
import { applyEvent } from '../src/game/engine/applyEvent.ts';
import { MAX_DICE_PER_COMMAND } from '../src/game/engine/validateCommand.ts';
import { SEED, command, copy, freeze, initial, known, player, players, ready, rejected, rules, step, system, transaction, unknown } from './fixtures/artificial-domain.mjs';

function scenario() {
  const ruleset = freeze(rules()); const start = freeze(initial(ruleset)); let state = start; const events = [];
  const plan = [
    ['InitializeMatch', system, { playerOrder: state.players.map((p) => p.id) }],
    ['AcknowledgeHandoff', player(), {}],
    ['PostTransaction', system, { transaction: transaction('credit', { toPlayerId: 'fixture-player-1' }, system, 'fixture-credit') }],
    ['PostTransaction', system, { transaction: transaction('debit', { fromPlayerId: 'fixture-player-2', amountUnits: 80 }, system, 'fixture-debit') }],
    ['PostTransaction', player(), { transaction: transaction('transfer', { fromPlayerId: 'fixture-player-1', toPlayerId: 'fixture-player-2', amountUnits: 125 }, player(), 'fixture-transfer') }],
    ['PrepareHandoff', system, { nextPlayerId: 'fixture-player-2' }],
    ['AcknowledgeHandoff', player('fixture-player-2'), {}],
    ['RollDice', player('fixture-player-2'), {}],
  ];
  for (const [kind, actor, fields] of plan) {
    const before = copy(state); const resolved = step(freeze(state), freeze(command(state, kind, actor, fields)), ruleset);
    assert.deepEqual(state, before); events.push(...resolved.events); state = resolved.state;
  }
  return { ruleset, start, state, events };
}
test('headless artificial scenario reproduces identical events/state and fixed outcomes', () => {
  const first = scenario(); const second = scenario();
  assert.deepEqual(first.events, second.events); assert.equal(serializeState(first.state), serializeState(second.state));
  assert.equal(first.state.revision, 8); assert.equal(first.state.turn.completedTurns, 1);
  assert.deepEqual(first.state.economy.accounts.map((a) => a.balanceUnits), [975, 1045]);
  assert.deepEqual(first.state.pendingDecision.faces, [1, 1]); assert.equal(first.state.rng.draws, 2);
  assert.deepEqual(first.state.players.map((p) => p.position.locationId), ['fixture-A', 'fixture-A']);
  assert.equal(first.state.completion.status, 'unconfigured'); assert.equal(first.state.decks, null);
  const digest = createHash('sha256').update(first.events.map(serializeEvent).join('\n') + '\n' + serializeState(first.state)).digest('hex');
  assert.equal(digest, '2c7c3c8aefb233c6b0a8e11a2f2ddd80b9d5fb938fb872d35a227b069f18946e');
});
test('serialized events replay independently, without rerolling, to the exact final state', () => {
  const fixture = scenario(); let restored = deserializeState(serializeState(fixture.start)).value;
  for (const event of fixture.events) {
    const decoded = deserializeEvent(serializeEvent(event)); assert.equal(decoded.ok, true);
    const result = applyEvent(freeze(restored), freeze(decoded.value)); assert.equal(result.ok, true, JSON.stringify(result)); restored = result.state;
  }
  assert.equal(serializeState(restored), serializeState(fixture.state));
});
test('replay uses recorded faces/checkpoint instead of regenerating outcomes', () => {
  const r = rules(); const state = ready(r); const result = step(state, command(state, 'RollDice', player()), r);
  const recorded = copy(result.events[0]); recorded.faces = [6, 5];
  // Outcome shape/state linkage validation is not cryptographic journal authentication.
  const replayed = applyEvent(state, recorded); assert.equal(replayed.ok, true); assert.deepEqual(replayed.state.pendingDecision.faces, [6, 5]);
  assert.deepEqual(replayed.state.rng, recorded.rngAfter);
});
test('revision, match, unknown actor and incorrect ruleset reject without input/RNG mutation', () => {
  const r = rules(); const state = ready(r);
  for (const [fields, code] of [
    [{ expectedRevision: state.revision - 1 }, 'REVISION_MISMATCH'], [{ matchId: 'other-match' }, 'MATCH_MISMATCH'],
    [{ actor: player('absent-player') }, 'INVALID_ACTOR'],
  ]) rejected(state, command(state, 'RollDice', player(), fields), r, code);
  rejected(state, command(state, 'RollDice', player()), { ...r, version: 'changed-version' }, 'RULESET_MISMATCH');
  rejected(state, command(state, 'RollDice', player()), rules({ startingCash: known(999) }), 'RULESET_MISMATCH');
  rejected(state, command(state, 'RollDice', player()), { ...r, schemaVersion: 2 }, 'INVALID_RULESET');
});
test('duplicate command retry and identity conflict are distinguished before stale revision rejection', () => {
  const r = rules(); const state = initial(r); const input = command(state, 'InitializeMatch', system, { playerOrder: state.players.map((p) => p.id) });
  const first = step(state, input, r);
  rejected(first.state, copy(input), r, 'DUPLICATE_COMMAND');
  rejected(first.state, { kind: input.kind, playerOrder: input.playerOrder, actor: input.actor, expectedRevision: input.expectedRevision,
    matchId: input.matchId, id: input.id, schemaVersion: input.schemaVersion }, r, 'DUPLICATE_COMMAND');
  rejected(first.state, { ...input, playerOrder: [...input.playerOrder].reverse() }, r, 'COMMAND_ID_CONFLICT');
  rejected(first.state, { ...input, expectedRevision: first.state.revision }, r, 'COMMAND_ID_CONFLICT');
});
test('invalid command identities/schema and malformed state reject explicitly', () => {
  const r = rules(); const state = ready(r);
  for (const id of ['', ' whitespace', '__proto__', 'constructor', 'x'.repeat(129)]) rejected(state, command(state, 'RollDice', player(), {}, id), r, 'INVALID_COMMAND');
  for (const fields of [{ schemaVersion: 2 }, { expectedRevision: -1 }, { extra: true }, { kind: 'UnimplementedGameAction' }]) rejected(state, command(state, 'RollDice', player(), fields), r, 'INVALID_COMMAND');
  rejected({ ...state, schemaVersion: 2 }, command(state, 'RollDice', player()), r, 'INVALID_STATE');
});
test('production draft cannot initialize or silently supply missing physical rules', () => {
  const r = validateRuleset(createOneChanceDraft()).value; const state = createGameState('owner-draft-match', players(), r, SEED);
  const failure = rejected(state, command(state, 'InitializeMatch', system, { playerOrder: state.players.map((p) => p.id) }), r, 'RULES_UNCONFIGURED');
  assert.deepEqual(failure.rejection.details, ['moneyUnit', 'startingCash', 'playerLimits', 'board', 'startingLocationId', 'turnOrder']);
  assert.equal(state.economy, null); assert.ok(state.players.every((p) => p.position === null));
});
test('missing dice and unsupported sampling work fail before RNG consumption', () => {
  for (const [definition, code] of [[unknown(), 'RULES_UNCONFIGURED'], [known({ count: MAX_DICE_PER_COMMAND + 1, sides: 6 }), 'ENGINE_LIMIT'], [known({ count: 1, sides: 0x100000001 }), 'ENGINE_LIMIT']]) {
    const r = rules({ dice: definition }); const state = ready(r); rejected(state, command(state, 'RollDice', player()), r, code);
  }
});
test('RNG exhaustion partway through a command is rejected atomically', () => {
  const r = rules(); const state = { ...ready(r), rng: { ...initial(r).rng, draws: Number.MAX_SAFE_INTEGER - 1 } };
  rejected(state, command(state, 'RollDice', player()), r, 'RNG_EXHAUSTED');
});
test('single-sided artificial dice records outcomes without consuming a word', () => {
  const r = rules({ dice: known({ count: 2, sides: 1 }) }); const state = ready(r);
  const result = step(state, command(state, 'RollDice', player()), r);
  assert.deepEqual(result.state.rng, state.rng); assert.deepEqual(result.state.pendingDecision.faces, [1, 1]);
});
test('initialization enforces sourced limits/permutation while engine supports more than six players', () => {
  const r = rules(); const state = initial(r, 8);
  const result = step(state, command(state, 'InitializeMatch', system, { playerOrder: [...state.players.map((p) => p.id)].reverse() }), r);
  assert.equal(result.state.players.length, 8); assert.equal(result.state.handoff.incomingPlayerId, 'fixture-player-8');
  assert.deepEqual(result.state.turn.playerOrder, [...state.players.map((p) => p.id)].reverse());
  for (const playerOrder of [[], ['fixture-player-1'], Array(8).fill('fixture-player-1'), [...state.players.map((p) => p.id).slice(0, 7), 'absent']]) rejected(state, command(state, 'InitializeMatch', system, { playerOrder }), r, 'INVALID_PLAYER_ORDER');
  const limited = rules({ playerLimits: known({ minimum: 1, maximum: 7 }) }); const invalid = initial(limited, 8);
  rejected(invalid, command(invalid, 'InitializeMatch', system, { playerOrder: invalid.players.map((p) => p.id) }), limited, 'INVALID_PLAYER_ORDER');
});
test('accepted outputs are detached from input state, command, event and ruleset objects', () => {
  const r = rules(); const state = initial(r); const input = command(state, 'InitializeMatch', system, { playerOrder: state.players.map((p) => p.id) });
  const result = step(state, input, r); const expected = copy(result.state);
  input.playerOrder[0] = 'changed'; state.players[0].name = 'changed'; r.configuration.board.value.locationIds[0] = 'changed';
  result.events[0].board.locationIds[0] = 'changed-event'; assert.deepEqual(result.state, expected);
});
test('money events retain originating command/event and enforce ledger rejections', () => {
  const r = rules(); const state = ready(r); const tx = transaction('debit', { fromPlayerId: 'fixture-player-1', amountUnits: 1001 });
  const rejectedMoney = rejected(state, command(state, 'PostTransaction', system, { transaction: tx }), r, 'ECONOMY_REJECTED');
  assert.deepEqual(rejectedMoney.rejection.details, ['INSUFFICIENT_FUNDS']);
  assert.equal(rejectedMoney.rejection.economyError, 'INSUFFICIENT_FUNDS');
  const accepted = step(state, command(state, 'PostTransaction', system, { transaction: { ...tx, amountUnits: 100 } }), r);
  assert.equal(accepted.events[0].posting.commandId, accepted.events[0].command.id); assert.equal(accepted.events[0].posting.eventId, accepted.events[0].id);
  const duplicate = rejected(accepted.state, command(accepted.state, 'PostTransaction', system, { transaction: { ...tx, amountUnits: 100 } }), r, 'ECONOMY_REJECTED');
  assert.deepEqual(duplicate.rejection.details, ['DUPLICATE_TRANSACTION']);
});
test('replay rejects duplicates, wrong order, corrupted outcome/origin/configuration without mutation', () => {
  const f = scenario(); const first = f.events[0]; const result = applyEvent(f.start, first); assert.equal(result.ok, true);
  const before = copy(result.state); freeze(result.state);
  assert.equal(applyEvent(result.state, first).rejection.code, 'EVENT_CONFLICT');
  assert.equal(applyEvent(f.start, f.events[1]).ok, false);
  const corruptions = [
    { ...first, board: { ...first.board, version: 'different-board' } },
    { ...first, openingEconomy: { ...first.openingEconomy, startingUnits: 5 } },
    { ...first, playerOrder: [...first.playerOrder].reverse() },
    { ...first, id: 'invalid-event-identity' }, { ...first, schemaVersion: 2 },
  ];
  for (const event of corruptions) assert.equal(applyEvent(f.start, event).ok, false);
  let state = f.start;
  for (const event of f.events.slice(0, -1)) state = applyEvent(state, event).state;
  const dice = f.events.at(-1);
  for (const event of [{ ...dice, faces: [0, 7] }, { ...dice, rngBefore: { ...dice.rngBefore, draws: 1 } }, { ...dice, rngAfter: dice.rngBefore }, { ...dice, playerId: 'fixture-player-1' }]) assert.equal(applyEvent(state, event).ok, false);
  assert.deepEqual(result.state, before);
});
test('maximum-length legal match identities roundtrip through generated event/decision identities', () => {
  const r = rules(); let state = initial(r, 2, SEED, 'm'.repeat(128));
  state = step(state, command(state, 'InitializeMatch', system, { playerOrder: state.players.map((p) => p.id) }), r).state;
  state = step(state, command(state, 'AcknowledgeHandoff', player()), r).state;
  state = step(state, command(state, 'RollDice', player()), r).state;
  assert.equal(deserializeState(serializeState(state)).ok, true);
});
