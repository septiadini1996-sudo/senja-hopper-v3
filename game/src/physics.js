// The flight model. One pure step function advances the plane by dt from a
// normalized input frame { pitch, bank, throttleDelta, throttleSet } — the
// same frame every control scheme and the autopilot produce. Landing grades
// come from the touchdown instant: sink rate, centreline offset, speed.

import { LEG, PLANE } from './config.js';
import { clamp, wave } from './rng.js';
import { windAt, stormCentreAt, flockAt } from './world.js';

export function newFlight(leg, opts) {
  return {
    phase: 'roll', // roll -> air -> landed | ditched
    dist: 0,
    lat: 0,
    alt: 0,
    speed: 0,
    vspeed: 0,
    throttle: 0,
    pitchVis: 0,
    bankVis: 0,
    hull: opts.maxHull,
    fuel: opts.fuelCapacity,
    time: 0,
    score: 0,
    stall: false,
    inStorm: false,
    touchdown: null,
    ringsHit: 0,
  };
}

/** Grade a touchdown: 0..100 from softness, centreline and approach speed. */
export function gradeTouchdown(vspeed, latOffset, speed, leniency) {
  const soft = clamp(100 - Math.max(0, Math.abs(vspeed) - 1.1) * 15, 0, 100);
  const centre = clamp(100 - Math.abs(latOffset) * 3.4, 0, 100);
  const ideal = speed >= 25 && speed <= 35 ? 100 : clamp(100 - Math.min(Math.abs(speed - 25), Math.abs(speed - 35)) * 6.5, 0, 100);
  const raw = soft * 0.45 + centre * 0.3 + ideal * 0.25;
  return { score: Math.round(clamp(100 - (100 - raw) / leniency, 0, 100)), soft: Math.round(soft), centre: Math.round(centre), speedScore: Math.round(ideal) };
}

export function stepFlight(f, leg, input, dt, opts) {
  const events = { rings: [], birds: [], storm: false, landed: false, ditched: false };
  if (f.phase === 'landed' || f.phase === 'ditched') return events;
  f.time += dt;
  if (input.throttleSet !== null && input.throttleSet !== undefined) f.throttle = clamp(input.throttleSet, 0, 1);
  else f.throttle = clamp(f.throttle + (input.throttleDelta || 0) * 0.55 * dt, 0, 1);
  const engineBonus = opts.engineLevel * 6;
  const topSpeed = PLANE.maxSpeed + engineBonus;
  const stallSpeed = PLANE.stallSpeed + (opts.heavyCargo ? 3 : 0);

  if (f.phase === 'roll') {
    const thrust = f.throttle * PLANE.accel * 2.4;
    const drag = PLANE.waterDrag * (f.speed / topSpeed) + f.speed * f.speed * PLANE.dragQuad;
    f.speed = Math.max(0, f.speed + (thrust - drag) * dt);
    f.dist += f.speed * dt;
    f.lat += (input.bank || 0) * 4 * dt;
    if (f.speed >= PLANE.rotateSpeed && (input.pitch || 0) > 0.2) {
      f.phase = 'air';
      f.alt = 0.5;
    }
    burnFuel(f, dt, opts);
    return events;
  }

  // Airborne.
  const pitch = clamp(input.pitch || 0, -1, 1);
  const bank = clamp(input.bank || 0, -1, 1);
  f.pitchVis += (pitch - f.pitchVis) * Math.min(1, dt * 7);
  f.bankVis += (bank - f.bankVis) * Math.min(1, dt * 5);
  const equilibrium = f.throttle * topSpeed;
  const speedRate = equilibrium > f.speed ? PLANE.accel * (0.35 + f.throttle) : 15;
  f.speed += clamp(equilibrium - f.speed, -speedRate * dt, speedRate * dt);
  f.speed -= pitch * 5.2 * dt * (pitch > 0 ? 1 : 0.45);
  f.speed = clamp(f.speed, 6, topSpeed + 14);

  let climb = pitch * PLANE.climbRate * clamp(f.speed / PLANE.rotateSpeed, 0, 1.12);
  f.stall = f.speed < stallSpeed;
  if (f.stall) climb -= (stallSpeed - f.speed) * 0.62;
  climb -= Math.abs(bank) * PLANE.turnSink;
  climb = clamp(climb, -PLANE.sinkRate - 6, PLANE.climbRate + 2);
  f.vspeed += (climb - f.vspeed) * Math.min(1, dt * 4.5);
  f.alt += f.vspeed * dt;
  const wind = windAt(leg, f.dist, f.time, opts.gustScale);
  f.lat += bank * PLANE.bankRate * dt * clamp(f.speed / PLANE.maxSpeed, 0.3, 1) + wind * dt;
  f.dist += f.speed * dt;

  // Storm cells: damage and turbulence.
  f.inStorm = false;
  for (const storm of leg.storms) {
    const centre = stormCentreAt(storm, f.time);
    if (Math.abs(f.dist - storm.dist) < storm.radius && Math.abs(f.lat - centre.lat) < storm.radius * 0.85 && f.alt < 190) {
      f.inStorm = true;
      f.hull -= LEG.stormDamage * (1 - opts.hullLevel * 0.18) * dt;
      f.lat += wave(f.time * 3.1, 2.2, 5.7, 9.3) * 9 * dt;
      f.alt += wave(f.time * 2.6 + 2, 1.8, 4.9, 8.1) * 5 * dt;
    }
  }
  events.storm = f.inStorm;
  if (f.hull <= 0) {
    f.hull = 0;
    f.phase = 'ditched';
    events.ditched = true;
    return events;
  }

  // Rings.
  for (const ring of leg.rings) {
    if (ring.scored === 0 && f.dist >= ring.dist) {
      const off = Math.hypot(f.lat - ring.lat, f.alt - ring.alt);
      if (off <= 6) { ring.scored = 1; f.score += LEG.ringCentre; }
      else if (off <= LEG.ringRadius) { ring.scored = 2; f.score += LEG.ringThread; }
      else if (off <= LEG.nearMiss) { ring.scored = 3; f.score += LEG.ringNear; }
      else ring.scored = 4;
      if (ring.scored <= 2) f.ringsHit += 1;
      events.rings.push({ ring, kind: ring.scored });
    }
  }

  // Bird flocks.
  for (const flock of leg.flocks) {
    if (flock.resolved === 0 && f.dist >= flock.dist) {
      const pos = flockAt(flock, f.time);
      const dLat = Math.abs(f.lat - pos.lat);
      const dAlt = Math.abs(f.alt - pos.alt);
      if (dLat < 9 && dAlt < 8) {
        flock.resolved = 1;
        f.hull -= LEG.birdDamage;
        events.birds.push({ flock, kind: 1 });
      } else if (dLat < 21 && dAlt < 17) {
        flock.resolved = 2;
        f.score += LEG.birdNearBonus;
        events.birds.push({ flock, kind: 2 });
      } else {
        flock.resolved = 3;
      }
    }
  }

  burnFuel(f, dt, opts);
  if (f.fuel <= 0) {
    f.fuel = 0;
    f.throttle = 0;
    if (f.speed < stallSpeed + 2 && f.alt < 4) { /* gliding to the water */ }
  }

  // Touchdown or ditch.
  if (f.alt <= 0) {
    f.alt = 0;
    const inStrip = f.dist > leg.length - 300 && f.dist < leg.length + 90;
    const onLine = Math.abs(f.lat - leg.stripLat) <= 30;
    if (inStrip && onLine && f.vspeed > -9.5) {
      f.phase = 'landed';
      f.touchdown = gradeTouchdown(f.vspeed, f.lat - leg.stripLat, f.speed, opts.leniency);
      events.landed = true;
    } else {
      f.phase = 'ditched';
      events.ditched = true;
    }
  }
  if (f.dist > leg.length + 400 && f.phase === 'air') {
    f.phase = 'ditched';
    events.ditched = true;
  }
  return events;
}

function burnFuel(f, dt, opts) {
  const burn = (0.5 + f.throttle * 0.62) * (opts.heavyCargo ? 1.15 : 1) * (100 / opts.fuelCapacity);
  f.fuel = Math.max(0, f.fuel - burn * dt);
}
