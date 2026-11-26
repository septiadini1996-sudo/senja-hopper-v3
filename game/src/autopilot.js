// A steady-handed autopilot that flies a leg the way the physics asks to be
// flown: full throttle on the water, rotate, chase the ring centres, then a
// managed glide onto the strip. Tests and staged screenshots fly with it, so
// what they show is the real game being played, not a posed frame.

import { PLANE } from './config.js';
import { clamp } from './rng.js';

/**
 * Produce the normalized input frame for this tick. `f` is the flight state,
 * `leg` the world, `mem` a scratch object the caller keeps between ticks.
 */
export function autopilotInput(f, leg, mem) {
  if (f.phase === 'roll') {
    return { pitch: f.speed > PLANE.rotateSpeed - 3 ? 0.65 : 0, bank: 0, throttleDelta: 0, throttleSet: 1 };
  }
  const remaining = leg.length - f.dist;
  let targetLat;
  let targetAlt;
  let targetSpeed;
  let onFinal = false;
  const nextRing = leg.rings.find((r) => r.scored === 0 && r.dist > f.dist - 10 && r.dist < leg.length - 420);
  if (nextRing && remaining > 430) {
    targetLat = nextRing.lat;
    targetAlt = nextRing.alt;
    targetSpeed = 44;
  } else if (remaining > 430) {
    targetLat = leg.stripLat;
    targetAlt = 105;
    targetSpeed = 47;
  } else {
    // Final approach: a glide slope that reaches the water at the strip's
    // near threshold (120 m before the leg's end), inside the touchdown window.
    onFinal = true;
    const slope = clamp((remaining - 120) / 500, 0, 1);
    targetLat = leg.stripLat;
    targetAlt = Math.max(0, slope * 92);
    targetSpeed = 29.5;
  }
  const altError = targetAlt - f.alt;
  let pitch = clamp(altError * (onFinal ? 0.06 : 0.045) - f.vspeed * 0.028, -1, 1);
  if (onFinal && altError < -2) pitch = Math.min(pitch, -0.34);
  if (f.speed < PLANE.stallSpeed + 7) pitch = Math.min(pitch, -0.12);
  if (f.alt < 2 && remaining > 620) pitch = Math.max(pitch, 0.25);
  const bank = clamp((targetLat - f.lat) * 0.042 - (mem.lastLatVel || 0) * 0.012, -1, 1);
  mem.lastLatVel = bank;
  const throttleSet = clamp(0.34 + (targetSpeed - f.speed) * 0.045, 0.08, 1);
  return { pitch, bank, throttleDelta: 0, throttleSet };
}

/** Fly a whole leg headlessly at a fixed step; returns { flight, events }. */
export function flyLeg(stepFlight, newFlight, leg, opts, dt, maxSeconds) {
  const f = newFlight(leg, opts);
  const mem = {};
  const log = { rings: [], birds: [], stormTicks: 0 };
  const steps = Math.floor(maxSeconds / dt);
  for (let i = 0; i < steps; i += 1) {
    const input = autopilotInput(f, leg, mem);
    const events = stepFlight(f, leg, input, dt, opts);
    log.rings.push(...events.rings);
    log.birds.push(...events.birds);
    if (events.storm) log.stormTicks += 1;
    if (f.phase === 'landed' || f.phase === 'ditched') break;
  }
  return { flight: f, log };
}
