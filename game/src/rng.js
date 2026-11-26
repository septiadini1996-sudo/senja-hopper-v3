// A small seeded random generator (mulberry32) so worlds, weather and staged
// screenshots are the same on every run for a given seed.

export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

/** Deterministic 1-D wave used for gusts and glitter: layered sines, no state. */
export function wave(t, a, b, c) {
  return Math.sin(t * a) * 0.55 + Math.sin(t * b + 1.7) * 0.3 + Math.sin(t * c + 4.1) * 0.15;
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
