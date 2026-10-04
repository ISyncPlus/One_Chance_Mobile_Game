import assert from 'node:assert/strict';
import test from 'node:test';
import { createOneChanceDraft } from '../src/game/content/oneChanceDraft.ts';
import { validateRuleset, assessReadiness, serializeRuleset, deserializeRuleset } from '../src/game/content/ruleset.ts';
import { copy, known, rawFixture, rules, source, unknown } from './fixtures/artificial-domain.mjs';

test('production draft preserves only supplied facts; all 22 physical configuration fields are unknown', () => {
  const draft = createOneChanceDraft(); const checked = validateRuleset(draft); assert.equal(checked.ok, true);
  assert.deepEqual(draft.facts.jambPassingFaces.value, [4, 5, 6]); assert.equal(draft.facts.beginsWithJamb.value, true);
  assert.equal(draft.facts.physicalCardCount.value, 32);
  assert.equal(Object.keys(draft.configuration).length, 22);
  for (const rule of Object.values(draft.configuration)) assert.deepEqual(rule, unknown());
  for (const rule of Object.values(draft.facts)) assert.equal(rule.sources[0].kind, 'product-brief');
  const readiness = assessReadiness(checked.value);
  assert.equal(readiness.playable, false); assert.equal(readiness.contentComplete, false);
  assert.equal(readiness.missingRules.length, 22); assert.deepEqual(readiness.missingFacts, []);
  assert.ok(readiness.unavailableEngineSystems.includes('jamb-resolution'));
});
test('complete artificial evidence is content-complete, but unsupported One Chance behaviour stays unavailable', () => {
  const draft = rawFixture();
  for (const key of Object.keys(draft.facts)) draft.facts[key] = known(true);
  Object.assign(draft.facts, { jambPassingFaces: known([1]), physicalCardCount: known(1), mechanicsPresent: known(['synthetic-mechanic']) });
  for (const [key, rule] of Object.entries(draft.configuration)) if (rule.status === 'unknown') draft.configuration[key] = known('Synthetic transcription; not executable physical-game rules');
  draft.configuration.cards = known([{ id: 'fixture-card', text: 'Synthetic evidence only; no gameplay effects' }]);
  const checked = validateRuleset(draft); assert.equal(checked.ok, true, JSON.stringify(checked));
  const readiness = assessReadiness(checked.value); assert.equal(readiness.contentComplete, true); assert.equal(readiness.playable, false);
  assert.deepEqual(readiness.missingRules, []); assert.deepEqual(readiness.missingFacts, []);
});
test('unknown never defaults to zero, false, absent values, or empty rule collections', () => {
  for (const invalid of [null, 0, false, [], { status: 'unknown', value: 0 }, { status: 'unknown' }, { status: 'unknown', value: null, sources: [] }, known(undefined), { status: 'confirmed', value: 0, sources: [] }]) {
    const draft = rawFixture(); draft.configuration.startingCash = invalid; assert.equal(validateRuleset(draft).ok, false, JSON.stringify(invalid));
  }
  const draft = rawFixture(); delete draft.configuration.tax; assert.equal(validateRuleset(draft).ok, false);
  const zero = rules({ startingCash: known(0) }); assert.equal(zero.configuration.startingCash.status, 'confirmed');
  assert.equal(zero.configuration.startingCash.value, 0); // explicit sourced zero is distinct from unknown
});
test('every confirmed rule needs provenance; production rejects artificial evidence', () => {
  const draft = rawFixture(); draft.configuration.startingCash.sources = []; assert.equal(validateRuleset(draft).ok, false);
  const production = rawFixture(); production.purpose = 'production'; assert.equal(validateRuleset(production).ok, false);

});
test('source identities cannot disagree; object insertion order is irrelevant', () => {
  const draft = rawFixture(); draft.configuration.startingCash.sources[0].edition = 'conflicting-edition';
  assert.equal(validateRuleset(draft).ok, false);
  const reordered = rawFixture(); reordered.configuration.startingCash.sources = [{ edition: source.edition, reference: source.reference, kind: source.kind, id: source.id }];
  assert.equal(validateRuleset(reordered).ok, true);
  const duplicate = rawFixture(); duplicate.configuration.startingCash.sources.push({ ...source }); assert.equal(validateRuleset(duplicate).ok, false);
});
test('ruleset rejects incompatible board references, card count, integer units, duplicate locations and versions', () => {
  const changes = [
    (d) => { d.configuration.startingLocationId = known('absent-location'); },
    (d) => { d.facts.physicalCardCount = known(2); d.configuration.cards = known([{ id: 'fixture-card', text: 'Synthetic' }]); },
    (d) => { d.configuration.moneyUnit.value.unitsPerMajor = 0.5; },
    (d) => { d.configuration.board.value.locationIds.push('fixture-A'); },
    (d) => { d.configuration.dice.value.sides = 0; },
    (d) => { d.configuration.startingCash = known(NaN); },
    (d) => { d.schemaVersion = 2; }, (d) => { d.purpose = 1; },
    (d) => { d.configuration.cards = known([, { id: 'fixture-card', text: 'Synthetic' }]); },
  ];
  for (const mutate of changes) { const draft = rawFixture(); mutate(draft); assert.equal(validateRuleset(draft).ok, false); }
});
test('ruleset canonical JSON roundtrip pins exact version and detaches source-owned structures', () => {
  const raw = rawFixture(); const validated = validateRuleset(raw).value; raw.configuration.board.value.locationIds[0] = 'changed';
  assert.equal(validated.configuration.board.value.locationIds[0], 'fixture-A');
  const encoded = serializeRuleset(validated); assert.deepEqual(deserializeRuleset(encoded), { ok: true, value: validated });
  assert.equal(deserializeRuleset('{').ok, false); assert.equal(deserializeRuleset(JSON.stringify({ ...validated, validationVersion: 2 })).ok, false);
  assert.throws(() => serializeRuleset({ ...copy(validated), schemaVersion: 2 }), TypeError);
});
