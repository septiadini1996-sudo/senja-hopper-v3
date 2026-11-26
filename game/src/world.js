// Leg generation: given a route between two islands and a seed, lay out the
// golden rings, drifting storm cells, bird flocks and the wind profile the
// pilot will fly through. Pure data — rendering and physics both read it.

import { ISLANDS, LEG } from './config.js';
import { makeRng, wave } from './rng.js';

/**
 * Build one leg. `from` and `to` are island indexes; `weather` scales storm
 * count and gust strength (story beats and later islands raise it).
 */
export function buildLeg(from, to, seed, weather) {
  const rng = makeRng(seed);
  const origin = ISLANDS[from];
  const dest = ISLANDS[to];
  const length = dest.dist + rng.range(-90, 90);
  const rings = [];
  for (let i = 0; i < LEG.ringCount; i += 1) {
    const t = (i + 1) / (LEG.ringCount + 1);
    rings.push({
      dist: length * t + rng.range(-40, 40),
      lat: Math.sin(t * Math.PI * 1.35 + rng.range(-0.3, 0.3)) * 68 + rng.range(-14, 14),
      // Low just after takeoff, rising across the leg: the first ring must be
      // reachable from a standing start, the middle ones ask for a real climb.
      alt: 30 + Math.sin(Math.min(t * 1.15, 1) * Math.PI * 0.5) * 70 + rng.range(-8, 8),
      scored: 0, // 0 untested, 1 centre, 2 thread, 3 near, 4 missed
    });
  }
  const storms = [];
  const stormCount = Math.round(weather * rng.range(0.7, 1.3)) + (weather >= 2 ? 1 : 0);
  for (let i = 0; i < stormCount; i += 1) {
    storms.push({
      dist: length * rng.range(0.22, 0.86),
      lat: rng.range(-120, 120),
      radius: rng.range(46, 74),
      drift: rng.range(2.5, 6) * rng.sign(),
      seed: rng.range(0, 40),
    });
  }
  const flocks = [];
  const flockCount = rng.int(1, 3);
  for (let i = 0; i < flockCount; i += 1) {
    flocks.push({
      dist: length * rng.range(0.18, 0.9),
      lat: rng.range(-110, 110),
      alt: rng.range(38, 120),
      speed: rng.range(6, 11) * rng.sign(),
      seed: rng.range(0, 40),
      resolved: 0, // 0 pending, 1 hit, 2 near pass
    });
  }
  return {
    from,
    to,
    origin,
    dest,
    length,
    rings,
    storms,
    flocks,
    seed,
    gustSeed: rng.range(0, 100),
    baseWind: rng.range(-3.2, 3.2) * (0.7 + weather * 0.25),
    stripLat: dest.lat * 0.4,
    stripAlt: 0,
  };
}

/** Crosswind (lateral m/s) at a distance along the leg: steady + gust waves. */
export function windAt(leg, dist, time, gustScale) {
  const steady = leg.baseWind;
  const gust = wave(dist * 0.004 + leg.gustSeed, 0.9, 2.3, 5.1) * 3.4 * gustScale;
  const front = wave(time * 0.35 + leg.gustSeed, 0.7, 1.9, 4.3) * 1.1 * gustScale;
  return steady + gust + front;
}

/** Where a storm cell is right now (its centre drifts sideways over time). */
export function stormCentreAt(storm, time) {
  const sway = Math.sin(time * 0.11 + storm.seed) * 26;
  return { lat: storm.lat + sway + Math.sin(time * 0.05 + storm.seed * 2) * storm.drift * 4, driftPhase: sway };
}

/** Where a bird flock is right now. */
export function flockAt(flock, time) {
  return { lat: flock.lat + Math.sin(time * 0.23 + flock.seed) * 34, alt: flock.alt + Math.sin(time * 0.9 + flock.seed) * 6 };
}
