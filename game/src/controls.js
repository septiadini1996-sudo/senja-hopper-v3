// The controller system: four control schemes — KEYBOARD, JOYSTICK, TOUCH and
// GYRO — all feeding ONE normalized input frame { pitch, bank, throttleDelta,
// throttleSet }. The flight model only ever sees that frame; it never knows
// which scheme produced it. Every scheme's mapping is a pure function so the
// test harness can drive all four with synthetic events.

import { clamp } from './rng.js';

export const SCHEMES = [
  { id: 'keyboard', name: 'KEYBOARD', nameId: 'PAPAN KETIK', blurb: 'Arrows steer · W/S throttle · Space ok' },
  { id: 'joystick', name: 'JOYSTICK', nameId: 'TUAS VIRTUAL', blurb: 'Drag the stick · slide throttle' },
  { id: 'touch', name: 'TOUCH', nameId: 'TOMBOL SENTUH', blurb: 'Big thumb buttons on screen' },
  { id: 'gyro', name: 'GYRO', nameId: 'SENSOR MIRING', blurb: 'Tilt the device to pitch & bank' },
];

export function schemeById(id) {
  return SCHEMES.find((s) => s.id === id) || SCHEMES[0];
}

/** On-screen geometry (view coordinates) for the pointer-driven schemes. */
export const STICK = { x: 168, y: 548, r: 86, knob: 34 };
export const THROTTLE_SLIDER = { x: 1128, y: 402, w: 40, h: 196 };
export const TOUCH_ZONES = [
  { id: 'bankLeft', x: 36, y: 452, w: 108, h: 108, label: '◀' },
  { id: 'bankRight', x: 268, y: 452, w: 108, h: 108, label: '▶' },
  { id: 'pitchDown', x: 152, y: 566, w: 108, h: 92, label: '▼' },
  { id: 'pitchUp', x: 152, y: 344, w: 108, h: 92, label: '▲' },
  { id: 'thrUp', x: 1136, y: 344, w: 108, h: 92, label: 'THR +' },
  { id: 'thrDown', x: 1136, y: 566, w: 108, h: 92, label: 'THR −' },
];

const DEADZONE = 0.08;

function dead(value) {
  return Math.abs(value) < DEADZONE ? 0 : value;
}

/** Keyboard state (a Set of KeyboardEvent codes) -> normalized frame. */
export function mapKeyboard(codes) {
  const has = (c) => codes.has(c);
  let pitch = 0;
  let bank = 0;
  let throttleDelta = 0;
  if (has('ArrowUp')) pitch += 1;
  if (has('ArrowDown')) pitch -= 1;
  if (has('ArrowLeft') || has('KeyA')) bank -= 1;
  if (has('ArrowRight') || has('KeyD')) bank += 1;
  if (has('KeyW')) throttleDelta += 1;
  if (has('KeyS')) throttleDelta -= 1;
  return { pitch, bank, throttleDelta, throttleSet: null };
}

/** Joystick drag offset from the stick centre -> normalized frame. */
export function mapJoystick(dx, dy) {
  const nx = clamp(dx / STICK.r, -1, 1);
  const ny = clamp(dy / STICK.r, -1, 1);
  return { pitch: dead(-ny), bank: dead(nx) };
}

/** Touch zones currently held (object of booleans by zone id) -> frame. */
export function mapTouch(zones) {
  let pitch = 0;
  let bank = 0;
  let throttleDelta = 0;
  if (zones.pitchUp) pitch += 1;
  if (zones.pitchDown) pitch -= 1;
  if (zones.bankLeft) bank -= 1;
  if (zones.bankRight) bank += 1;
  if (zones.thrUp) throttleDelta += 1;
  if (zones.thrDown) throttleDelta -= 1;
  return { pitch, bank, throttleDelta, throttleSet: null };
}

/**
 * Device orientation -> frame. `neutral` is the tilt captured at calibration;
 * full deflection is 26 degrees divided by sensitivity. In landscape the
 * device's axes swap, so pitch reads gamma and bank reads beta.
 */
export function mapGyro(beta, gamma, neutral, sensitivity, landscape) {
  if (beta === null || gamma === null || !neutral) return { pitch: 0, bank: 0 };
  const full = 26 / Math.max(0.4, sensitivity || 1);
  let pitchDeg;
  let bankDeg;
  if (landscape) {
    pitchDeg = -(gamma - neutral.gamma);
    bankDeg = beta - neutral.beta;
  } else {
    pitchDeg = -(beta - neutral.beta);
    bankDeg = gamma - neutral.gamma;
  }
  return {
    pitch: dead(clamp(pitchDeg / full, -1, 1)),
    bank: dead(clamp(bankDeg / full, -1, 1)),
  };
}

export function gyroSupported() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

export function gyroNeedsPermission() {
  return gyroSupported() && typeof window.DeviceOrientationEvent.requestPermission === 'function';
}

/** Live controller: owns listeners and per-scheme state for the browser game. */
export function createControls() {
  const keys = new Set();
  const stick = { active: false, pointerId: null, dx: 0, dy: 0 };
  const slider = { active: false, pointerId: null, value: null };
  const touchZones = {};
  const touchPointers = new Map();
  let gyroReading = { beta: null, gamma: null };
  let gyroNeutral = null;
  let gyroListening = false;
  let scheme = 'keyboard';
  let confirmEdge = false;
  let pauseEdge = false;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (event.code === 'Space' || event.code === 'Enter') confirmEdge = true;
    if (event.code === 'Escape' || event.code === 'KeyP') pauseEdge = true;
    keys.add(event.code);
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onOrientation(event) {
    gyroReading = { beta: event.beta, gamma: event.gamma };
  }

  return {
    attach() {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
    },
    get scheme() { return scheme; },
    setScheme(id) { scheme = id; },
    /** Pointer input in view coordinates, routed by the active scheme. */
    pointer(type, x, y, pointerId) {
      if (scheme === 'joystick') {
        if (type === 'down') {
          if (Math.hypot(x - STICK.x, y - STICK.y) < STICK.r + 26) {
            stick.active = true; stick.pointerId = pointerId; stick.dx = x - STICK.x; stick.dy = y - STICK.y;
          } else if (x >= THROTTLE_SLIDER.x - 18 && x <= THROTTLE_SLIDER.x + THROTTLE_SLIDER.w + 18 && y >= THROTTLE_SLIDER.y - 14 && y <= THROTTLE_SLIDER.y + THROTTLE_SLIDER.h + 14) {
            slider.active = true; slider.pointerId = pointerId;
            slider.value = clamp(1 - (y - THROTTLE_SLIDER.y) / THROTTLE_SLIDER.h, 0, 1);
          }
        } else if (type === 'move') {
          if (stick.active && pointerId === stick.pointerId) { stick.dx = x - STICK.x; stick.dy = y - STICK.y; }
          if (slider.active && pointerId === slider.pointerId) slider.value = clamp(1 - (y - THROTTLE_SLIDER.y) / THROTTLE_SLIDER.h, 0, 1);
        } else if (type === 'up') {
          if (pointerId === stick.pointerId) { stick.active = false; stick.dx = 0; stick.dy = 0; }
          if (pointerId === slider.pointerId) slider.active = false;
        }
      } else if (scheme === 'touch') {
        if (type === 'down' || type === 'move') {
          const zone = TOUCH_ZONES.find((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
          touchPointers.set(pointerId, zone ? zone.id : null);
        } else if (type === 'up') {
          touchPointers.delete(pointerId);
        }
        for (const z of TOUCH_ZONES) touchZones[z.id] = false;
        for (const id of touchPointers.values()) if (id) touchZones[id] = true;
      }
    },
    stickState() { return stick; },
    sliderState() { return slider; },
    touchState() { return touchZones; },
    /** Ask iOS for motion permission; resolves true when gyro may be used. */
    async requestGyro() {
      if (!gyroSupported()) return false;
      try {
        if (gyroNeedsPermission()) {
          const reply = await window.DeviceOrientationEvent.requestPermission();
          if (reply !== 'granted') return false;
        }
      } catch (err) {
        return false;
      }
      this.startGyro();
      return true;
    },
    startGyro() {
      if (!gyroListening && gyroSupported()) {
        window.addEventListener('deviceorientation', onOrientation);
        gyroListening = true;
      }
    },
    calibrateGyro() {
      if (gyroReading.beta !== null) gyroNeutral = { beta: gyroReading.beta, gamma: gyroReading.gamma };
      return gyroNeutral !== null;
    },
    gyroCalibrated() { return gyroNeutral !== null; },
    feedGyroForTest(beta, gamma) { gyroReading = { beta, gamma }; },
    /** The one normalized frame for this tick. */
    sample() {
      let frame;
      if (scheme === 'joystick') {
        const j = mapJoystick(stick.dx, stick.dy);
        frame = { pitch: j.pitch, bank: j.bank, throttleDelta: 0, throttleSet: slider.value };
      } else if (scheme === 'touch') {
        frame = mapTouch(touchZones);
      } else if (scheme === 'gyro') {
        const landscape = typeof window !== 'undefined' && window.innerWidth >= window.innerHeight;
        const g = mapGyro(gyroReading.beta, gyroReading.gamma, gyroNeutral, 1, landscape);
        frame = { pitch: g.pitch, bank: g.bank, throttleDelta: keys.has('KeyW') ? 1 : keys.has('KeyS') ? -1 : 0, throttleSet: null };
      } else {
        frame = mapKeyboard(keys);
      }
      frame.confirm = confirmEdge;
      frame.pause = pauseEdge;
      confirmEdge = false;
      pauseEdge = false;
      return frame;
    },
  };
}
