// Deterministic PRNG (mulberry32). The seed lives inside the game state so
// simulations and replays are reproducible and saves restore the same stream.
export interface HasRng {
  rng: number;
}

export function rand(s: HasRng): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(s: HasRng, min: number, maxInclusive: number): number {
  return min + Math.floor(rand(s) * (maxInclusive - min + 1));
}

export function pick<T>(s: HasRng, arr: readonly T[]): T {
  return arr[Math.floor(rand(s) * arr.length) % arr.length];
}
