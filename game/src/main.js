// Senja Hopper — boot and orchestration: the screen state machine, the fixed
// -step flight loop, pointer routing (menus vs. the active control scheme),
// settlement, persistence, and the staged-shot host the screenshots use.

import { ISLANDS, SEASONS, STEP, VIEW } from './config.js';
import { browserStorage, defaultSave, loadSave, storeSave, wipeSave } from './save.js';
import { createAudio } from './audio.js';
import { createControls } from './controls.js';
import { buildLeg } from './world.js';
import { morningBoard, makeTicket } from './orders.js';
import { newFlight, stepFlight } from './physics.js';
import { autopilotInput } from './autopilot.js';
import { buyUpgrade, fuelCapacity, maxHull, nextGoal, settleFlight } from './campaign.js';
import { drawFlightScene, projX, projY } from './render.js';
import {
  drawBoard, drawChallenges, drawControls, drawDitched, drawHangar, drawHowTo,
  drawPause, drawReceipt, drawSettings, drawStats, drawTitle, hitTest, makeHitList,
} from './screens.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const storage = browserStorage();
let save = loadSave(storage);
const audio = createAudio();
audio.setEnabled(save.sound);
const controls = createControls();
controls.attach();
controls.setScheme(save.scheme);
if (save.scheme === 'gyro') controls.startGyro();

let screen = 'title';
let backTarget = 'title';
let hits = makeHitList();
let board = null;
let selectedTicket = null;
let preflight = 'fuel';
let leg = null;
let flight = null;
let ticketNow = null;
let flightOpts = null;
let flightSettled = false;
let receipt = null;
let popups = [];
let ringPoints = 0;
let ringCentres = 0;
let ringThreads = 0;
let streak = save.streak || 0;
let apMem = {};
let gyroArmCalibrate = false;
let gyroForced = false;
let visTime = 0;

// A calm backdrop flight for the menu screens: parked on the water at Bali.
const backdropLeg = buildLeg(0, 1, 4242, 1);
const backdropFlight = newFlight(backdropLeg, { maxHull: 100, fuelCapacity: 100 });
backdropFlight.speed = 12;
backdropFlight.throttle = 0.5;

function persist() {
  save.streak = streak;
  storeSave(storage, save);
}

function flightOptions() {
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

function flyTicket(ticket, chosenPreflight) {
  preflight = chosenPreflight;
  ticketNow = chosenPreflight === 'crate' ? { ...ticket, basePay: ticket.basePay + 35 } : ticket;
  leg = buildLeg(ticket.from, ticket.to, ticket.seed + save.day * 13, ticket.weather);
  flightOpts = flightOptions();
  flight = newFlight(leg, flightOpts);
  popups = [];
  ringPoints = 0;
  ringCentres = 0;
  ringThreads = 0;
  flightSettled = false;
  apMem = {};
  screen = 'flight';
}

function popup(text, color, worldLat, worldAlt) {
  popups.push({
    text,
    color,
    x: projX(worldLat - flight.lat, 60),
    y: projY(flight.alt, worldAlt, 60, 0) - 26,
    t: visTime,
  });
}

function handleEvents(events) {
  for (const ev of events.rings) {
    if (ev.kind === 1) { ringPoints += 250; ringCentres += 1; popup('+250 DEAD CENTRE!', '#7bf1a8', ev.ring.lat, ev.ring.alt); audio.ring(true); }
    else if (ev.kind === 2) { ringPoints += 100; ringThreads += 1; popup('+100 THREADED', '#ffd60a', ev.ring.lat, ev.ring.alt); audio.ring(false); }
    else if (ev.kind === 3) { ringPoints += 40; popup('+40 NEAR MISS', '#ffd9a0', ev.ring.lat, ev.ring.alt); audio.nearMiss(); }
    else popup('MISSED', '#b9c6ce', ev.ring.lat, ev.ring.alt);
  }
  for (const ev of events.birds) {
    if (ev.kind === 1) { popup('BIRD STRIKE — HULL −9', '#ef6461', flight.lat, flight.alt + 14); audio.alarm(); }
    else popup('+25 NEAR PASS', '#ffd9a0', flight.lat, flight.alt + 14);
  }
}

function settleCurrent() {
  if (!flight || flightSettled) return;
  flightSettled = true;
  if (flight.phase === 'landed') {
    const gradeScore = flight.touchdown.score;
    streak = gradeScore >= 86 ? streak + 1 : 0;
    const settle = settleFlight(save, {
      ticket: ticketNow,
      landed: true,
      gradeScore,
      ringScore: ringPoints,
      ringCentres,
      ringThreads,
      streak,
      late: flight.time > ticketNow.clock,
    });
    receipt = { ticket: ticketNow, touchdown: flight.touchdown, settle, streak };
    audio.stamp();
    screen = 'receipt';
  } else {
    streak = 0;
    settleFlight(save, { ticket: ticketNow, landed: false, gradeScore: 0, ringScore: 0, ringCentres: 0, ringThreads: 0, streak: 0, late: false });
    audio.splash();
    screen = 'ditched';
  }
  save.started = true;
  persist();
}

function step(dt, useAutopilot) {
  if (!flight || flightSettled) return;
  const input = useAutopilot ? autopilotInput(flight, leg, apMem) : controls.sample();
  if (!useAutopilot) {
    if (input.pause) { screen = 'pause'; return; }
    if (input.confirm && save.scheme === 'gyro') controls.calibrateGyro();
  }
  const events = stepFlight(flight, leg, input, dt, flightOpts);
  handleEvents(events);
  if (flight.phase === 'landed' || flight.phase === 'ditched') settleCurrent();
}

/* ------------------------------ host for shots ------------------------------ */

const host = {
  freshSave: () => defaultSave(),
  setSave(s) { save = s; },
  get flight() { return flight; },
  get leg() { return leg; },
  flyTicket,
  step,
  settleCurrent,
  clearPopups() { popups = []; },
  setScreen(name) { screen = name; },
  setGyroForced(v) { gyroForced = v; },
  makeTicket,
};

/* ------------------------------ interaction ------------------------------ */

function openBoard() {
  board = morningBoard(save);
  selectedTicket = null;
  preflight = 'fuel';
  screen = 'board';
}

async function chooseScheme(id) {
  if (id === 'gyro') {
    const ok = await controls.requestGyro();
    if (!ok) return;
    gyroArmCalibrate = true;
  }
  save.scheme = id;
  controls.setScheme(id);
  persist();
  audio.click();
}

function goBack() {
  if (screen === 'pause') { screen = 'flight'; return; }
  screen = backTarget;
  if (screen === 'board' && !board) openBoard();
}

function dispatch(id) {
  if (!id) return;
  audio.unlock();
  const [head, arg] = id.split(':');
  if (head === 'ticket') { selectedTicket = Number(arg); audio.click(); return; }
  if (head === 'preflight') { preflight = arg; audio.click(); return; }
  if (head === 'scheme') { chooseScheme(arg); return; }
  if (head === 'season') { save.season = Number(arg); persist(); audio.click(); return; }
  if (head === 'gyrosens') { save.gyroSensitivity = Number(arg); persist(); audio.click(); return; }
  if (head === 'buy') {
    if (buyUpgrade(save, arg)) { persist(); audio.click(); }
    return;
  }
  switch (id) {
    case 'newgame':
      wipeSave(storage);
      save = defaultSave();
      save.started = true;
      streak = 0;
      persist();
      openBoard();
      break;
    case 'continue': openBoard(); break;
    case 'howto': backTarget = screen === 'title' ? 'title' : backTarget; if (screen === 'title') backTarget = 'title'; screen = 'howto'; break;
    case 'controls': if (screen !== 'controls') backTarget = screen; screen = 'controls'; break;
    case 'challenges': backTarget = 'title'; screen = 'challenges'; break;
    case 'stats': backTarget = 'title'; screen = 'stats'; break;
    case 'settings': if (screen !== 'settings') backTarget = screen; screen = 'settings'; break;
    case 'hangar': screen = 'hangar'; break;
    case 'board': openBoard(); break;
    case 'fly': if (selectedTicket !== null) { audio.click(); flyTicket(board[selectedTicket], preflight); } break;
    case 'sound': save.sound = !save.sound; audio.setEnabled(save.sound); persist(); break;
    case 'reset': wipeSave(storage); save = defaultSave(); streak = 0; persist(); screen = 'title'; break;
    case 'gyrocal': controls.calibrateGyro(); audio.click(); break;
    case 'resume': screen = 'flight'; break;
    case 'quit': screen = 'title'; flight = null; break;
    case 'back': goBack(); break;
    default: break;
  }
}

function toView(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEW.width,
    y: ((event.clientY - rect.top) / rect.height) * VIEW.height,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  audio.unlock();
  const p = toView(event);
  if (screen === 'flight') {
    if (save.scheme === 'gyro' && p.x > VIEW.width / 2 - 128 && p.x < VIEW.width / 2 + 128 && p.y > 556 && p.y < 592) {
      controls.calibrateGyro();
      return;
    }
    controls.pointer('down', p.x, p.y, event.pointerId);
  } else {
    dispatch(hitTest(hits, p.x, p.y));
  }
});
canvas.addEventListener('pointermove', (event) => {
  if (screen !== 'flight') return;
  const p = toView(event);
  controls.pointer('move', p.x, p.y, event.pointerId);
});
canvas.addEventListener('pointerup', (event) => {
  if (screen !== 'flight') return;
  const p = toView(event);
  controls.pointer('up', p.x, p.y, event.pointerId);
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') {
    if (screen === 'flight') screen = 'pause';
    else if (screen === 'pause') screen = 'flight';
    else if (!['title', 'board', 'receipt', 'ditched'].includes(screen)) goBack();
  }
});

/* ------------------------------ rendering ------------------------------ */

function flightView(bare) {
  return {
    flight, leg, ticket: ticketNow, time: visTime, popups, streak,
    cash: save.cash,
    countdown: ticketNow ? ticketNow.clock - flight.time : null,
    nextGoal: nextGoal(save),
    fuelCapacity: flightOpts.fuelCapacity, maxHull: flightOpts.maxHull,
    scheme: save.scheme, controls, screen, bare,
  };
}

function backdropView() {
  return {
    flight: backdropFlight, leg: backdropLeg, ticket: null, time: visTime, popups: [],
    streak: 0, cash: save.cash, countdown: null, nextGoal: '', fuelCapacity: 100, maxHull: 100,
    scheme: save.scheme, controls, screen, bare: true,
  };
}

function render() {
  hits = makeHitList();
  const S = { save, board, selectedTicket, preflight, receipt, ticket: ticketNow, controls, gyroForced };
  if (screen === 'flight') {
    drawFlightScene(ctx, flightView(false));
  } else if (screen === 'pause') {
    drawFlightScene(ctx, flightView(true));
    drawPause(ctx, hits, S);
  } else if (screen === 'receipt') {
    drawFlightScene(ctx, flightView(true));
    drawReceipt(ctx, hits, S);
  } else if (screen === 'ditched') {
    drawFlightScene(ctx, flightView(true));
    drawDitched(ctx, hits, S);
  } else {
    drawFlightScene(ctx, backdropView());
    if (screen === 'title') drawTitle(ctx, hits, S);
    else if (screen === 'howto') drawHowTo(ctx, hits, S);
    else if (screen === 'controls') drawControls(ctx, hits, S);
    else if (screen === 'challenges') drawChallenges(ctx, hits, S);
    else if (screen === 'stats') drawStats(ctx, hits, S);
    else if (screen === 'settings') drawSettings(ctx, hits, S);
    else if (screen === 'board') drawBoard(ctx, hits, S);
    else if (screen === 'hangar') drawHangar(ctx, hits, S);
  }
}

/* ------------------------------ boot & loop ------------------------------ */

function fit() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
}
window.addEventListener('resize', fit);
fit();

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  stageShot(shotName, host);
  window.__senjaShotReady = shotName;
}

let last = performance.now();
let accumulator = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  visTime += dt;
  if (gyroArmCalibrate && controls.calibrateGyro()) gyroArmCalibrate = false;
  if (screen === 'flight' && !shotName) {
    accumulator += dt;
    while (accumulator >= STEP) {
      step(STEP, false);
      accumulator -= STEP;
      if (screen !== 'flight') { accumulator = 0; break; }
    }
    popups = popups.filter((p) => visTime - p.t < 1.6);
  }
  if (screen === 'flight') audio.flight(flight ? flight.throttle : 0, flight ? flight.speed / 68 : 0, !!flight);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
