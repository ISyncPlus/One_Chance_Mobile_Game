import { canonicalJson, isArrayOf, hasKeys, isNatural, isRecord, type Validation } from '../domain/validation.ts';

export const RNG_ALGORITHM = 'xoshiro128ss-v1' as const;
const UINT32_SIZE = 0x100000000;
export interface RngState {
  readonly algorithm: typeof RNG_ALGORITHM;
  readonly words: readonly [number, number, number, number];
  readonly draws: number;
}
export interface Draw<T> { readonly value: T; readonly state: RngState }

export function isRngState(value: unknown): value is RngState {
  return isRecord(value) && hasKeys(value, ['algorithm', 'words', 'draws']) &&
    value.algorithm === RNG_ALGORITHM && isNatural(value.draws) && isArrayOf(value.words, isNatural) &&
    value.words.length === 4 && value.words.every((word: unknown) => isNatural(word) && word < UINT32_SIZE) &&
    value.words.some((word: unknown) => word !== 0);
}
export function restoreRng(value: unknown): Validation<RngState> {
  return isRngState(value) ? { ok: true, value: { ...value, words: [...value.words] } } :
    { ok: false, issues: ['Unsupported or invalid RNG state'] };
}
/** Seed is the complete initial state: four big-endian hex uint32 words, not a text hash. */
export function seedRng(seed: string): RngState {
  if (typeof seed !== 'string' || !/^[0-9a-f]{32}$/.test(seed) || /^0{32}$/.test(seed)) {
    throw new RangeError('Seed must be 32 lowercase hexadecimal characters, not all zero');
  }
  const word = (offset: number) => Number.parseInt(seed.slice(offset, offset + 8), 16);
  return { algorithm: RNG_ALGORITHM, words: [word(0), word(8), word(16), word(24)], draws: 0 };
}
function rotateLeft(word: number, bits: number): number {
  return ((word << bits) | (word >>> (32 - bits))) >>> 0;
}
export function nextUint32(state: RngState): Draw<number> {
  if (!isRngState(state) || state.draws === Number.MAX_SAFE_INTEGER) throw new RangeError('Invalid or exhausted RNG state');
  let [a, b, c, d] = state.words;
  const value = Math.imul(rotateLeft(Math.imul(b, 5), 7), 9) >>> 0;
  const shifted = b << 9;
  c ^= a; d ^= b; b ^= c; a ^= d; c ^= shifted; d = rotateLeft(d, 11);
  return { value, state: { algorithm: RNG_ALGORITHM, words: [a >>> 0, b >>> 0, c >>> 0, d >>> 0], draws: state.draws + 1 } };
}
/** Inclusive endpoints; rejection sampling avoids modulo bias. A singleton consumes no word. */
export function sampleInteger(state: RngState, min: number, max: number): Draw<number> {
  if (!isRngState(state) || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) ||
      Object.is(min, -0) || Object.is(max, -0) || min > max || max - min >= UINT32_SIZE) {
    throw new RangeError('Integer range must be ordered safe integers spanning at most 2^32 values');
  }
  if (min === max) return { value: min, state: { ...state, words: [...state.words] } };
  const span = max - min + 1;
  const limit = Math.floor(UINT32_SIZE / span) * span;
  let cursor = state;
  while (true) {
    const draw = nextUint32(cursor); cursor = draw.state;
    if (draw.value < limit) return { value: min + draw.value % span, state: cursor };
  }
}
/** Descending Fisher–Yates; copies input. Empty/singleton arrays consume no randomness. */
export function shuffle<T>(state: RngState, input: readonly T[]): Draw<readonly T[]> {
  if (!isRngState(state) || !Array.isArray(input)) throw new RangeError('Invalid RNG state or shuffle input');
  const value = [...input]; let cursor = state;
  for (let i = value.length - 1; i > 0; i--) {
    const draw = sampleInteger(cursor, 0, i); cursor = draw.state;
    const left = value[i]; const right = value[draw.value];
    // Array indices above are in range; T may itself legitimately be undefined.
    value[i] = right as T; value[draw.value] = left as T;
  }
  return { value, state: cursor };
}

export function serializeRng(state: RngState): string {
  if (!isRngState(state)) throw new TypeError('Invalid RNG state');
  return canonicalJson(state);
}
export function deserializeRng(text: string): Validation<RngState> {
  try { return restoreRng(JSON.parse(text)); }
  catch { return { ok: false, issues: ['Invalid RNG JSON'] }; }
}
