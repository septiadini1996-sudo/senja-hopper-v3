// Senja Hopper test harness — run with: node tests/run-tests.mjs
// Exercises the pure modules: all four control-scheme mappings, the flight
// model (autopilot-flown legs, stall, storm damage, ditching), campaign
// settlement, hangar purchases and the save round-trip.

import { STEP, SEASONS } from '../game/src/config.js';
import { defaultSave, loadSave, storeSave } from '../game/src/save.js';
import {
  SCHEMES, STICK, createControls, gyroSupported, mapGyro, mapJoystick, mapKeyboard, mapTouch,
} from '../game/src/controls.js';
import { buildLeg } from '../game/src/world.js';
import { makeTicket, morningBoard } from '../game/src/orders.js';
import { newFlight, stepFlight, gradeTouchdown } from '../game/src/physics.js';
import { autopilotInput, flyLeg } from '../game/src/autopilot.js';
import { buyUpgrade, fuelCapacity, maxHull, settleFlight } from '../game/src/campaign.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}
function near(a, b, eps = 0.001) {
  return Math.abs(a - b) < eps;
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function legOpts(save, preflight) {
  const season = SEASONS[save.season];
  return {
    maxHull: maxHull(save),
    fuelCapacity: fuelCapacity(save) * (preflight === 'fuel' ? 1.45 : 1),
    engineLevel: save.upgrades.engine,
    hullLevel: save.upgrades.hull,
    gustScale: season.gust,
    leniency: season.leniency,
    heavyCargo: preflight === 'crate',
  };
}

/* ------------------------- control scheme mappings ------------------------- */

const kb = mapKeyboard(new Set(['ArrowUp', 'KeyW', 'ArrowLeft']));
check('keyboard mapping', kb.pitch === 1 && kb.bank === -1 && kb.throttleDelta === 1, JSON.stringify(kb));

const joy = mapJoystick(STICK.r * 0.5, -STICK.r * 0.5);
check('joystick mapping', near(joy.bank, 0.5, 0.01) && near(joy.pitch, 0.5, 0.01), JSON.stringify(joy));
const joyDead = mapJoystick(2, -2);
check('joystick deadzone', joyDead.pitch === 0 && joyDead.bank === 0);

const tch = mapTouch({ pitchUp: true, bankRight: true, thrDown: true });
check('touch mapping', tch.pitch === 1 && tch.bank === 1 && tch.throttleDelta === -1, JSON.stringify(tch));

const neutral = { beta: 40, gamma: 10 };
const g0 = mapGyro(40, 10, neutral, 1, false);
check('gyro neutral is zero', g0.pitch === 0 && g0.bank === 0);
const g1 = mapGyro(40 - 26, 10 + 13, neutral, 1, false);
check('gyro portrait deflection', near(g1.pitch, 1, 0.01) && near(g1.bank, 0.5, 0.01), JSON.stringify(g1));
const g2 = mapGyro(40 + 13, 10 - 26, neutral, 1, true);
check('gyro landscape axes swap', near(g2.pitch, 1, 0.01) && near(g2.bank, 0.5, 0.01), JSON.stringify(g2));

// The live controller: calibration captures neutral, then readings steer.
const controls = createControls();
controls.setScheme('gyro');
controls.feedGyroForTest(40, 10);
check('gyro calibration captures neutral', controls.calibrateGyro() === true);
controls.feedGyroForTest(40 - 26, 10 + 13);
const gyroFrame = controls.sample();
check('gyro live frame matches pure mapping', near(gyroFrame.pitch, 1, 0.01) && near(gyroFrame.bank, 0.5, 0.01), JSON.stringify(gyroFrame));
check('gyro unsupported in this environment', gyroSupported() === false);
check('four schemes registered', SCHEMES.map((s) => s.id).join(',') === 'keyboard,joystick,touch,gyro');

/* ------------------------------ full flights ------------------------------ */

const save = defaultSave();
const board = morningBoard(save);
check('morning board has 3 tickets', board.length === 3, board.map((t) => t.cargoName).join(' | '));
check('day-1 story ticket is Ibu Ratna to Nusa Penida', board[0].customer === 'Ibu Ratna' && board[0].to === 1 && board[0].cargoId === 'medicine');

const ticket = board[0];
const leg = buildLeg(ticket.from, ticket.to, ticket.seed + save.day * 13, ticket.weather);
const run1 = flyLeg(stepFlight, newFlight, leg, legOpts(save, 'fuel'), STEP, 600);
check('day-1 medicine run lands', run1.flight.phase === 'landed', `phase=${run1.flight.phase} time=${run1.flight.time.toFixed(1)}s`);
if (run1.flight.phase === 'landed') {
  const td = run1.flight.touchdown;
  check('day-1 landing grades S or A', td.score >= 72, `score=${td.score} soft=${td.soft} centre=${td.centre} speed=${td.speedScore}`);
  check('day-1 flight threads rings', run1.flight.ringsHit >= 2, `ringsHit=${run1.flight.ringsHit} score=${run1.flight.score}`);
  check('day-1 fuel remains', run1.flight.fuel > 5, `fuel=${run1.flight.fuel.toFixed(1)}`);
}

// A longer, stormier leg: Sumbawa -> Flores in monsoon weather.
const stormSave = defaultSave();
stormSave.season = 2; // monsoon
const stormTicket = makeTicket(6, 3, 4, 4, 987123, null);
const stormLeg = buildLeg(stormTicket.from, stormTicket.to, stormTicket.seed + 6 * 13, 3);
const stormOpts = legOpts(stormSave, 'fuel');
stormOpts.gustScale = SEASONS[2].gust;
stormOpts.leniency = SEASONS[2].leniency;
const run2 = flyLeg(stepFlight, newFlight, stormLeg, stormOpts, STEP, 900);
check('storm leg lands graded', run2.flight.phase === 'landed' && run2.flight.touchdown.score >= 0, `phase=${run2.flight.phase} score=${run2.flight.touchdown ? run2.flight.touchdown.score : 'n/a'} hull=${run2.flight.hull.toFixed(0)} stormTicks=${run2.log.stormTicks}`);

/* --------------------------- flight model edges --------------------------- */

// Stall: slow, nose high — the plane must sink and flag the stall.
{
  const f = newFlight(leg, legOpts(save, 'fuel'));
  f.phase = 'air'; f.alt = 120; f.speed = 14; f.throttle = 0;
  let sawStall = false;
  for (let i = 0; i < 120; i += 1) {
    stepFlight(f, leg, { pitch: 1, bank: 0, throttleDelta: 0, throttleSet: 0 }, STEP, legOpts(save, 'fuel'));
    if (f.stall) sawStall = true;
  }
  check('stall flags and sinks', sawStall && f.alt < 120, `alt=${f.alt.toFixed(1)} stall=${sawStall}`);
}

// Storm damage: parked inside a cell for two seconds of sim time.
{
  const stormy = buildLeg(0, 4, 555, 3);
  const cell = stormy.storms[0];
  check('storm leg has cells', stormy.storms.length >= 1, `cells=${stormy.storms.length}`);
  const f = newFlight(stormy, legOpts(save, 'fuel'));
  f.phase = 'air'; f.alt = 100; f.speed = 44; f.dist = cell.dist; f.lat = cell.lat;
  const hullBefore = f.hull;
  for (let i = 0; i < 120; i += 1) {
    // Hold position inside the cell against the drift.
    f.dist = cell.dist; f.lat = cell.lat + Math.sin(f.time * 0.11 + cell.seed) * 26;
    stepFlight(f, stormy, { pitch: 0.1, bank: 0, throttleDelta: 0, throttleSet: 0.7 }, STEP, legOpts(save, 'fuel'));
  }
  check('storm cell chews hull', f.hull < hullBefore, `hull ${hullBefore} -> ${f.hull.toFixed(1)}`);
}

// Ditching: descend to the water far from the strip.
{
  const f = newFlight(leg, legOpts(save, 'fuel'));
  f.phase = 'air'; f.alt = 26; f.speed = 34; f.dist = leg.length * 0.4;
  let guard = 0;
  while (f.phase === 'air' && guard < 60 * 60) {
    stepFlight(f, leg, { pitch: -1, bank: 0, throttleDelta: 0, throttleSet: 0.2 }, STEP, legOpts(save, 'fuel'));
    guard += 1;
  }
  check('descending to open water ditches', f.phase === 'ditched', `phase=${f.phase} after ${(guard / 60).toFixed(1)}s`);
}

// Touchdown grading sanity: a greaser beats a arrival from the sky.
{
  const soft = gradeTouchdown(-1.2, 0, 30, 1);
  const hard = gradeTouchdown(-8, 24, 52, 1);
  check('grading rewards soft centred arrivals', soft.score > hard.score && soft.score >= 95, `soft=${soft.score} hard=${hard.score}`);
}

/* ------------------------------- campaign ------------------------------- */

{
  const s = defaultSave();
  const t = makeTicket(1, 0, 1, 0, 424242, { id: 'ratna-1', weather: 1 });
  const before = s.cash;
  const settle = settleFlight(s, { ticket: t, landed: true, gradeScore: 93, ringScore: 350, ringCentres: 2, ringThreads: 1, streak: 1, late: false });
  check('settlement pays and stamps', s.cash > before && settle.stamp && settle.stamp.island === 'NUSA PENIDA', `cash ${before}->${s.cash} total=${settle.total}`);
  check('settlement unlocks and advances the day', s.islandIndex === 1 && s.atIsland === 1 && s.day === 2);
  const ditch = settleFlight(s, { ticket: t, landed: false, gradeScore: 0, ringScore: 0, ringCentres: 0, ringThreads: 0, streak: 0, late: false });
  check('ditched settlement pays nothing', ditch.total === 0 && s.stats.ditched === 1);
}

{
  const s = defaultSave();
  s.cash = 200;
  check('hangar purchase works', buyUpgrade(s, 'engine') === true && s.upgrades.engine === 1 && s.cash === 110, `cash=${s.cash}`);
  check('hangar refuses when broke', buyUpgrade(s, 'tank') === true && buyUpgrade(s, 'tank') === false, `tank=${s.upgrades.tank} cash=${s.cash}`);
}

/* --------------------------------- save --------------------------------- */

{
  const storage = memoryStorage();
  const s = defaultSave();
  s.scheme = 'gyro';
  s.upgrades.hull = 2;
  s.stamps = { penida: 'S' };
  storeSave(storage, s);
  const back = loadSave(storage);
  check('save round-trips with control scheme', back.scheme === 'gyro' && back.upgrades.hull === 2 && back.stamps.penida === 'S');
  const corrupt = memoryStorage();
  corrupt.setItem('senja-hopper-save-v3', '{not json');
  check('corrupt save falls back to default', loadSave(corrupt).scheme === 'keyboard');
}

// Autopilot determinism: same seed, same flight, twice.
{
  const a = flyLeg(stepFlight, newFlight, leg, legOpts(save, 'fuel'), STEP, 600);
  const b = flyLeg(stepFlight, newFlight, leg, legOpts(save, 'fuel'), STEP, 600);
  check('autopilot flight is deterministic', a.flight.phase === b.flight.phase && near(a.flight.time, b.flight.time) && a.flight.score === b.flight.score);
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
