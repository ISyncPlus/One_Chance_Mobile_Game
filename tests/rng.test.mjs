import assert from 'node:assert/strict';
import test from 'node:test';
import { seedRng, nextUint32, sampleInteger, shuffle, restoreRng, serializeRng, deserializeRng, RNG_ALGORITHM } from '../src/game/random/rng.ts';
import { SEED, freeze, copy } from './fixtures/artificial-domain.mjs';

// Independently generated with the authors' uint32 C reference (fixtures/xoshiro-reference.c).
const vectors = [
  { seed: SEED, values: [11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034, 3734860849, 3729100597, 4258142804, 337829053, 2142557243], words: [732694577, 3850432822, 1098276040, 1542782851] },
  { seed: 'ffffffff123456789abcdef00fedcba9', values: [2576977301, 4294964986, 3292631909, 1466622816, 1840212533, 842195006, 3877518445, 3067890383, 2049467958, 760322872, 2421959146, 1604134357], words: [2183706322, 3329199627, 2044702687, 4105181547] },
];
for (const [index, vector] of vectors.entries()) test(`xoshiro128** golden vector ${index + 1}: 12 words and checkpoint`, () => {
  let rng = freeze(seedRng(vector.seed));
  for (const value of vector.values) { const draw = nextUint32(rng); assert.equal(draw.value, value); rng = freeze(draw.state); }
  assert.deepEqual(rng, { algorithm: RNG_ALGORITHM, words: vector.words, draws: 12 });
});
test('RNG JSON checkpoint restores exactly and detaches caller words', () => {
  let rng = seedRng(SEED); for (let i = 0; i < 7; i++) rng = nextUint32(rng).state;
  const restored = deserializeRng(serializeRng(rng)); assert.equal(restored.ok, true);
  assert.deepEqual(nextUint32(restored.value), nextUint32(rng));
  const raw = copy(rng); const checked = restoreRng(raw); raw.words[0] = 0; assert.deepEqual(checked.value, rng);
});
test('inclusive integer/range golden values and Fisher–Yates order remain stable', () => {
  let rng = seedRng(SEED); const faces = [];
  for (let i = 0; i < 12; i++) { const draw = sampleInteger(rng, 1, 6); faces.push(draw.value); rng = draw.state; }
  assert.deepEqual(faces, [1, 1, 1, 1, 6, 1, 1, 2, 2, 3, 2, 6]);
  const input = freeze(['A', 'B', 'C', 'D', 'E', 'F']);
  const shuffled = shuffle(seedRng(SEED), input);
  assert.deepEqual(shuffled.value, ['C', 'B', 'D', 'E', 'F', 'A']);
  assert.equal(shuffled.state.draws, 5); assert.deepEqual(input, ['A', 'B', 'C', 'D', 'E', 'F']);
});
test('rejection sampling discards three high words rather than using biased modulo', () => {
  const sampled = sampleInteger(seedRng(vectors[1].seed), 0, 2147483648);
  assert.equal(sampled.value, 1466622816); assert.equal(sampled.state.draws, 4);
});
test('range endpoints, full uint32 width, negative offsets and safe-integer extremes', () => {
  const rng = seedRng(SEED);
  assert.equal(sampleInteger(rng, 0, 0xffffffff).value, 11520);
  assert.equal(sampleInteger(rng, -10, 10).value, -10 + 11520 % 21);
  assert.equal(sampleInteger(rng, Number.MAX_SAFE_INTEGER - 3, Number.MAX_SAFE_INTEGER).value, Number.MAX_SAFE_INTEGER - 3);
  assert.equal(sampleInteger(rng, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER + 3).value, Number.MIN_SAFE_INTEGER);
});
test('singleton, empty and single-item shuffle consume no randomness', () => {
  const rng = freeze(seedRng(SEED));
  assert.deepEqual(sampleInteger(rng, 7, 7), { value: 7, state: rng });
  assert.deepEqual(shuffle(rng, []).state, rng); assert.deepEqual(shuffle(rng, ['only']).state, rng);
});
test('invalid seeds, ranges and states fail explicitly without mutation', () => {
  for (const seed of ['', '0'.repeat(32), 'ABCDEF'.padEnd(32, '0'), 'bad', 123]) assert.throws(() => seedRng(seed), RangeError);
  const rng = freeze(seedRng(SEED)); const before = copy(rng);
  for (const [min, max] of [[2, 1], [0.1, 4], [0, Infinity], [0, 0x100000000], [-0, 5], [0, Number.MAX_SAFE_INTEGER + 1]]) assert.throws(() => sampleInteger(rng, min, max), RangeError);
  for (const raw of [null, { ...rng, algorithm: 'future-v2' }, { ...rng, words: [0, 0, 0, 0] }, { ...rng, words: [1, , 3, 4] }, { ...rng, words: [1, 2, 3, 0x100000000] }, { ...rng, draws: -1 }, { ...rng, extra: true }]) assert.equal(restoreRng(raw).ok, false);
  assert.throws(() => nextUint32({ ...rng, draws: Number.MAX_SAFE_INTEGER }), RangeError);
  assert.throws(() => shuffle(rng, 'invalid'), RangeError);
  assert.throws(() => serializeRng({ ...rng, words: [0, 0, 0, 0] }), TypeError);
  assert.equal(deserializeRng('bad-json').ok, false); assert.deepEqual(rng, before);
});
