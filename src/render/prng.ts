/** mulberry32: tiny, fast, good-enough PRNG. Same seed, same sequence, everywhere. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixes any number of integers into one uint32 (murmur3-style finalizer per input). */
export function hashInts(...values: number[]): number {
  let h = 0x811c9dc5;
  for (const v of values) {
    let k = Math.imul(v | 0, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A PRNG keyed by several integers, e.g. rng(seed, step, elementIndex). */
export function rngFor(...keys: number[]): () => number {
  return mulberry32(hashInts(...keys));
}

/** Uniform in [-1, 1). */
export const signed = (rng: () => number) => rng() * 2 - 1;

export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 2 ** 32) >>> 0;
}

/** Stream tags so different uses of the same seed don't correlate. */
export const STREAM = {
  layout: 1,
  jitter: 2,
  drop: 3,
  grain: 4,
  flicker: 5,
  paper: 6,
} as const;
