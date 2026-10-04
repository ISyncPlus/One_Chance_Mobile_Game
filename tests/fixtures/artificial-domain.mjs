// ARTIFICIAL ENGINE TEST DATA. These values/rules/locations/currency are not One Chance content.
import assert from 'node:assert/strict';
import { createOneChanceDraft } from '../../src/game/content/oneChanceDraft.ts';
import { validateRuleset } from '../../src/game/content/ruleset.ts';
import { createGameState } from '../../src/game/domain/state.ts';
import { resolveCommand } from '../../src/game/engine/resolveCommand.ts';

export const SEED = '00000001000000020000000300000004';
export const source = { id: 'artificial-test-evidence', kind: 'test-fixture', reference: 'Synthetic domain contract tests; never physical-game evidence', edition: 'test-v1' };
export const known = (value) => ({ status: 'confirmed', value, sources: [{ ...source }] });
export const unknown = () => ({ status: 'unknown', value: null });
export const copy = (value) => JSON.parse(JSON.stringify(value));
export function freeze(value) {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function rawFixture() {
  const draft = createOneChanceDraft();
  draft.id = 'artificial-contract-fixture'; draft.version = 'fixture-v1'; draft.purpose = 'test-fixture';
  for (const key of Object.keys(draft.facts)) draft.facts[key] = unknown();
  Object.assign(draft.configuration, {
    moneyUnit: known({ currencyCode: 'TEST', unitLabel: 'synthetic-unit', unitsPerMajor: 100 }),
    startingCash: known(1000), playerLimits: known({ minimum: 1, maximum: 12 }),
    dice: known({ count: 2, sides: 6 }), board: known({ id: 'artificial-board', version: 'fixture-board-v1', locationIds: ['fixture-A', 'fixture-B'] }),
    startingLocationId: known('fixture-A'), turnOrder: known('provided-order'), negativeBalancePolicy: known('reject-negative'),
  });
  return draft;
}
export function rules(overrides = {}) {
  const raw = rawFixture(); Object.assign(raw.configuration, overrides);
  const checked = validateRuleset(raw); assert.equal(checked.ok, true, JSON.stringify(checked)); return checked.value;
}
export function players(count = 2) {
  return Array.from({ length: count }, (_, index) => ({ id: `fixture-player-${index + 1}`, name: `Synthetic Player ${index + 1}`, characterId: `fixture-character-${index + 1}` }));
}
export function initial(ruleset = rules(), count = 2, seed = SEED, matchId = 'fixture-match') {
  return createGameState(matchId, players(count), ruleset, seed);
}
export const system = { kind: 'system' };
export const player = (id = 'fixture-player-1') => ({ kind: 'player', playerId: id });
export function command(state, kind, actor = system, fields = {}, id = `fixture-command-${state.revision + 1}`) {
  return { schemaVersion: 1, id, matchId: state.matchId, expectedRevision: state.revision, actor, kind, ...fields };
}
export function step(state, input, ruleset) {
  const resolved = resolveCommand(state, input, ruleset); assert.equal(resolved.ok, true, JSON.stringify(resolved)); return resolved;
}
export function initialized(ruleset = rules(), count = 2) {
  const state = initial(ruleset, count);
  return step(state, command(state, 'InitializeMatch', system, { playerOrder: state.players.map((p) => p.id) }), ruleset).state;
}
export function ready(ruleset = rules(), count = 2) {
  const state = initialized(ruleset, count);
  return step(state, command(state, 'AcknowledgeHandoff', player()), ruleset).state;
}
export function transaction(kind, fields = {}, origin = system, id = 'fixture-transaction') {
  return { id, kind, origin, amountUnits: 100, reason: 'Synthetic financial invariant', reference: 'artificial-tests', ...fields };
}
export function rejected(state, input, ruleset, code) {
  const original = copy(state); freeze(state); freeze(input); freeze(ruleset);
  const result = resolveCommand(state, input, ruleset);
  assert.equal(result.ok, false); assert.equal(result.rejection.code, code, JSON.stringify(result));
  assert.deepEqual(state, original); assert.deepEqual(state.rng, original.rng); return result;
}
