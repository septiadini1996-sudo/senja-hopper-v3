// All canvas drawing for the flight itself: the golden-hour archipelago in
// pseudo-3D, the seaplane from behind, rings, storms, birds, the runway, the
// instrument cluster and the HUD. One palette, one illustration style.

import { PALETTE, VIEW, LEG } from './config.js';
import { clamp, makeRng, wave } from './rng.js';
import { stormCentreAt, flockAt } from './world.js';
import { STICK, THROTTLE_SLIDER, TOUCH_ZONES } from './controls.js';
import { drawCargoIcon, drawChallengeIcon, drawControlIcon, rr } from './icons.js';

export const HORIZON = 300;
const CX = VIEW.width / 2;

export function scaleAt(rel) {
  return 300 / (Math.max(rel, -28) + 55);
}
export function projX(latOff, rel) {
  return CX + latOff * scaleAt(rel) * 4.2;
}
export function projY(planeAlt, objAlt, rel, pitchVis) {
  return HORIZON + (planeAlt + 26 - objAlt) * scaleAt(rel) + (pitchVis || 0) * 42;
}

function skyGradient(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 30);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.52, PALETTE.skyMid);
  g.addColorStop(0.82, PALETTE.skyLow);
  g.addColorStop(1, PALETTE.horizon);
  return g;
}

function seaGradient(ctx) {
  const g = ctx.createLinearGradient(0, HORIZON, 0, VIEW.height);
  g.addColorStop(0, PALETTE.seaFar);
  g.addColorStop(0.25, '#2b7f92');
  g.addColorStop(1, PALETTE.seaNear);
  return g;
}

/** Far island silhouettes on the horizon: two parallax layers. */
function drawFarIslands(ctx, plane, seed) {
  const layers = [
    { par: 0.12, color: PALETTE.hillFar, base: HORIZON + 4, amp: 38 },
    { par: 0.3, color: PALETTE.hillMid, base: HORIZON + 10, amp: 25 },
  ];
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    ctx.globalAlpha = 0.85;
    const pts = [];
    for (let x = -40; x <= VIEW.width + 40; x += 40) {
      const worldX = x + plane.dist * layer.par + plane.lat * layer.par * 2;
      const h = (Math.sin(worldX * 0.004 + seed) * 0.5 + Math.sin(worldX * 0.0013 + seed * 2) * 0.5) * layer.amp + layer.amp * 0.4;
      pts.push([x, layer.base - Math.max(2, h)]);
    }
    ctx.beginPath();
    ctx.moveTo(-40, layer.base);
    ctx.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i += 1) {
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    }
    ctx.lineTo(VIEW.width + 40, layer.base);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSun(ctx, time) {
  const sx = 935;
  const sy = 148;
  const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 190);
  glow.addColorStop(0, 'rgba(255, 183, 3, 0.55)');
  glow.addColorStop(1, 'rgba(255, 183, 3, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 200, sy - 200, 400, 400);
  ctx.fillStyle = PALETTE.sunCore;
  ctx.beginPath();
  ctx.arc(sx, sy, 37 + Math.sin(time * 0.7) * 1.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Sea with a glitter path under the sun and foam streaks for speed. */
function drawSea(ctx, plane, time) {
  ctx.fillStyle = seaGradient(ctx);
  ctx.fillRect(0, HORIZON, VIEW.width, VIEW.height - HORIZON);
  // Distance shimmer bands.
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = PALETTE.horizon;
  for (let i = 0; i < 9; i += 1) {
    const rel = 60 + i * i * 26;
    const y = projY(plane.alt, 0, rel, 0);
    if (y > HORIZON + 4 && y < VIEW.height) ctx.fillRect(0, y, VIEW.width, 1.6);
  }
  ctx.globalAlpha = 1;
  // Sun glitter: deterministic dashes that tighten toward the horizon.
  for (let i = 0; i < 46; i += 1) {
    const row = i / 46;
    const y = HORIZON + 14 + row * row * (VIEW.height - HORIZON - 30);
    const rng = makeRng(9000 + i * 77 + Math.floor(plane.dist / 30));
    const w = 12 + row * 90 * rng.next();
    const x = 935 + (rng.next() - 0.5) * (60 + row * 420) + wave(time * 0.8, 1.3, 2.9, 5.7) * 6 * row;
    ctx.globalAlpha = 0.16 + row * 0.5;
    ctx.fillStyle = PALETTE.glitter;
    ctx.fillRect(x - w / 2, y, w, 2 + row * 2.4);
  }
  ctx.globalAlpha = 1;
  // Foam streaks rushing past at low level: the speed cue.
  const speedRatio = clamp(plane.speed / 60, 0, 1);
  if (plane.alt < 90 && speedRatio > 0.15) {
    ctx.strokeStyle = 'rgba(254, 246, 228, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i += 1) {
      const rng = makeRng(400 + i * 31 + Math.floor(plane.dist / 55));
      const rel = 12 + rng.next() * 130;
      const y = projY(plane.alt, 0, rel, 0);
      if (y < HORIZON + 10 || y > VIEW.height - 6) continue;
      const lat = (rng.next() - 0.5) * 260;
      const x = projX(lat - plane.lat, rel);
      const len = (10 + speedRatio * 46) * scaleAt(rel);
      ctx.globalAlpha = 0.12 + speedRatio * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (lat > 0 ? len : -len) * 0.2, y + len * 0.24);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** One scenery island: layered ridges — far purple, grass slope, sand beach. */
function drawIsland(ctx, cxPx, baseY, widthPx, seed, near) {
  const rng = makeRng(seed);
  const bumps = [];
  const n = 6;
  for (let i = 0; i <= n; i += 1) bumps.push(0.5 + rng.next() * 0.5);
  const peak = widthPx * 0.19;
  const ridge = (shrink, lift) => {
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const x = cxPx - (widthPx / 2) * shrink + (widthPx * shrink * i) / n;
      pts.push([x, baseY - bumps[i] * peak * lift * Math.pow(Math.sin((i / n) * Math.PI), 0.7)]);
    }
    ctx.beginPath();
    ctx.moveTo(cxPx - (widthPx / 2) * shrink, baseY);
    ctx.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i += 1) {
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    ctx.lineTo(cxPx + (widthPx / 2) * shrink, baseY);
    ctx.closePath();
  };
  ctx.fillStyle = PALETTE.hillFar;
  ridge(1, 1);
  ctx.fill();
  ctx.fillStyle = PALETTE.grassDark;
  ridge(0.86, 0.72);
  ctx.fill();
  ctx.fillStyle = PALETTE.grass;
  ridge(0.7, 0.5);
  ctx.fill();
  ctx.fillStyle = PALETTE.beach;
  ctx.beginPath();
  ctx.ellipse(cxPx, baseY, widthPx * 0.52, widthPx * 0.03 + 3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (near) {
    // Palm silhouettes on the beach.
    ctx.strokeStyle = PALETTE.grassDark;
    ctx.lineWidth = Math.max(1.5, widthPx * 0.006);
    for (let i = 0; i < 4; i += 1) {
      const px = cxPx + (rng.next() - 0.5) * widthPx * 0.6;
      const ph = widthPx * (0.05 + rng.next() * 0.04);
      ctx.beginPath();
      ctx.moveTo(px, baseY - 2);
      ctx.quadraticCurveTo(px + ph * 0.2, baseY - ph * 0.6, px + ph * 0.34, baseY - ph);
      ctx.stroke();
      for (let f = 0; f < 5; f += 1) {
        const a = -0.4 - f * 0.5;
        ctx.beginPath();
        ctx.moveTo(px + ph * 0.34, baseY - ph);
        ctx.quadraticCurveTo(px + ph * 0.34 + Math.cos(a) * ph * 0.3, baseY - ph + Math.sin(a) * ph * 0.3 - ph * 0.1, px + ph * 0.34 + Math.cos(a) * ph * 0.52, baseY - ph + Math.sin(a) * ph * 0.42);
        ctx.stroke();
      }
    }
  }
}

/** Seeded scenery islands sliding past on both sides of the course. */
function drawScenery(ctx, plane, leg) {
  const samples = [1250, 980, 760, 580, 430, 320, 235, 165, 110, 65, 28];
  for (const rel of samples) {
    const band = Math.floor((plane.dist + rel) / 170);
    const rng = makeRng(leg.seed * 31 + band * 977);
    if (!rng.chance(0.66)) continue;
    const side = rng.sign();
    const lat = side * rng.range(150, 330);
    const inBand = (plane.dist + rel) - band * 170;
    const trueRel = rel + (rng.range(0, 120) - inBand * 0.4);
    if (trueRel < 8) continue;
    const s = scaleAt(trueRel);
    const widthPx = Math.min(880, rng.range(150, 330) * s * 4.2);
    if (widthPx < 26) continue;
    const x = projX(lat - plane.lat, trueRel);
    if (x < -widthPx || x > VIEW.width + widthPx) continue;
    const y = projY(plane.alt, 0, trueRel, plane.pitchVis);
    drawIsland(ctx, x, y, widthPx, leg.seed * 13 + band * 71, trueRel < 300);
  }
}

function drawCloud(ctx, x, y, scale, warm) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale * 0.62);
  ctx.fillStyle = warm ? PALETTE.cloudShade : PALETTE.cloudFar;
  for (const [cx, cy, r] of [[-38, 8, 30], [0, -6, 40], [40, 8, 30], [0, 12, 44]]) {
    ctx.beginPath(); ctx.arc(cx, cy + 7, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = warm ? PALETTE.cloudWarm : '#b3a6d9';
  for (const [cx, cy, r] of [[-34, 2, 27], [2, -12, 37], [38, 2, 27]]) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawClouds(ctx, plane, leg, time) {
  for (let i = 0; i < 7; i += 1) {
    const rel = 300 + i * 210 - ((plane.dist * 0.9) % 210);
    const rng = makeRng(leg.seed * 3 + Math.floor((plane.dist + i * 210) / 210) * 17 + i * 101);
    const lat = (rng.next() - 0.5) * 620;
    const alt = 150 + rng.next() * 90;
    const x = projX(lat - plane.lat, rel);
    const y = projY(plane.alt, alt, rel, plane.pitchVis) + Math.sin(time * 0.3 + i) * 3;
    drawCloud(ctx, x, y, scaleAt(rel) * 1.8, i % 2 === 0);
  }
}

function drawStorm(ctx, plane, leg, storm, time) {
  const rel = storm.dist - plane.dist;
  if (rel < -60 || rel > 1600) return;
  const centre = stormCentreAt(storm, time);
  const x = projX(centre.lat - plane.lat, rel);
  const topY = projY(plane.alt, 205, rel, plane.pitchVis);
  const baseY = projY(plane.alt, 0, rel, plane.pitchVis);
  const w = Math.min(470, storm.radius * 2 * scaleAt(rel) * 4.2);
  if (w < 8) return;
  ctx.save();
  ctx.globalAlpha = clamp(1.05 - rel / 1500, 0.22, 0.84);
  // A cumulonimbus head: round puffs clustered on a shared base line, lit
  // from above — never a stack of flat ellipses.
  const baseLine = topY + w * 0.3;
  ctx.fillStyle = PALETTE.storm;
  const puffs = [
    [0, -0.16, 0.27], [-0.24, -0.05, 0.2], [0.24, -0.05, 0.2],
    [-0.4, 0.04, 0.15], [0.4, 0.04, 0.15], [-0.12, -0.24, 0.18], [0.14, -0.22, 0.16],
  ];
  for (const [ox, oy, orad] of puffs) {
    ctx.beginPath();
    ctx.arc(x + ox * w, baseLine + oy * w, orad * w, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath(); ctx.ellipse(x, baseLine + w * 0.05, w * 0.47, w * 0.09, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.stormLight;
  for (const [ox, oy, orad] of [[-0.12, -0.24, 0.18], [0.14, -0.22, 0.16], [0, -0.16, 0.27]]) {
    ctx.beginPath();
    ctx.arc(x + ox * w, baseLine + oy * w - w * 0.045, orad * w * 0.92, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();
  }
  // Rain shaft.
  ctx.strokeStyle = PALETTE.rain;
  ctx.globalAlpha *= 0.5;
  ctx.lineWidth = Math.max(1, w * 0.012);
  const rainTop = topY + (baseY - topY) * 0.34;
  for (let i = 0; i < 9; i += 1) {
    const rng = makeRng(storm.seed * 7 + i * 29 + Math.floor(time * 9));
    const rx = x + (rng.next() - 0.5) * w * 0.8;
    ctx.beginPath();
    ctx.moveTo(rx, rainTop + rng.next() * 16);
    ctx.lineTo(rx - 4, baseY - 4);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawRing(ctx, plane, ring, time) {
  const rel = ring.dist - plane.dist;
  if (rel < -24 || rel > 1500) return;
  const s = scaleAt(rel);
  const x = projX(ring.lat - plane.lat, rel);
  const y = projY(plane.alt, ring.alt, rel, plane.pitchVis);
  const rx = Math.max(3, 11.5 * s * 4.2);
  const ry = rx * 0.94;
  ctx.save();
  if (ring.scored === 4) ctx.globalAlpha = 0.35;
  const scored = ring.scored === 1 || ring.scored === 2;
  const glow = ring.scored === 0 && rel < 420;
  if (glow) {
    ctx.shadowColor = PALETTE.gold;
    ctx.shadowBlur = 22 * s;
  }
  ctx.lineWidth = Math.max(2, rx * 0.17);
  ctx.strokeStyle = scored ? PALETTE.teal : PALETTE.goldDeep;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1.2, rx * 0.08);
  ctx.strokeStyle = scored ? '#9ff5e6' : PALETTE.gold;
  ctx.beginPath(); ctx.ellipse(x, y, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawBirds(ctx, plane, leg, flock, time) {
  const rel = flock.dist - plane.dist;
  if (rel < -30 || rel > 900 || flock.resolved === 1) return;
  const pos = flockAt(flock, time);
  const s = scaleAt(rel);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = Math.max(1.2, 2.2 * s);
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i += 1) {
    const offLat = (i - 2) * 7 + Math.sin(time * 2 + i) * 1.5;
    const offAlt = Math.abs(i - 2) * -2.4 + Math.sin(time * 3.1 + i * 2) * 1.2;
    const x = projX(pos.lat + offLat - plane.lat, rel);
    const y = projY(plane.alt, pos.alt + offAlt, rel, plane.pitchVis);
    const wing = (3.4 + Math.sin(time * 11 + flock.seed + i * 1.7) * 2.2) * s * 1.6;
    const span = 5.2 * s * 1.6;
    ctx.beginPath();
    ctx.moveTo(x - span, y - wing * 0.4);
    ctx.quadraticCurveTo(x - span * 0.4, y + wing * 0.5, x, y);
    ctx.quadraticCurveTo(x + span * 0.4, y + wing * 0.5, x + span, y - wing * 0.4);
    ctx.stroke();
  }
}

/** The destination island and its water strip on final approach. */
function drawRunway(ctx, plane, leg) {
  const remaining = leg.length - plane.dist;
  if (remaining > 1500) return;
  if (remaining < 210) {
    // On the strip: the island becomes the ground itself — a sand apron with
    // a grass verge and the strip's edge lights running past the floats.
    const gy = projY(plane.alt, 0, 34, plane.pitchVis);
    ctx.fillStyle = PALETTE.beach;
    ctx.fillRect(0, gy, VIEW.width, VIEW.height - gy);
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, gy, VIEW.width, 12);
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(CX - 210, gy + 12, 420, VIEW.height - gy);
    ctx.fillStyle = PALETTE.gold;
    for (let i = 0; i < 5; i += 1) {
      const ly = gy + 30 + i * 62;
      ctx.beginPath(); ctx.arc(CX - 216, ly, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(CX + 216, ly, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  const nearRel = Math.max(remaining - 60, -20);
  const farRel = remaining + 300;
  const islandX = projX(leg.stripLat - plane.lat, Math.max(farRel, 1));
  const islandY = projY(plane.alt, 0, Math.max(farRel, 1), plane.pitchVis);
  const islandW = Math.min(1150, 460 * scaleAt(Math.max(farRel, 1)) * 4.2);
  drawIsland(ctx, islandX, islandY + 6, islandW, leg.seed * 7 + leg.to, remaining < 420);
  // Strip: a trapezoid from far threshold to near threshold.
  const x1 = projX(leg.stripLat - 30 - plane.lat, farRel);
  const x2 = projX(leg.stripLat + 30 - plane.lat, farRel);
  const yFar = projY(plane.alt, 0, farRel, plane.pitchVis);
  const x3 = projX(leg.stripLat + 30 - plane.lat, nearRel);
  const x4 = projX(leg.stripLat - 30 - plane.lat, nearRel);
  const yNear = projY(plane.alt, 0, nearRel, plane.pitchVis);
  ctx.fillStyle = '#8a6f4d';
  ctx.beginPath();
  ctx.moveTo(x1, yFar); ctx.lineTo(x2, yFar); ctx.lineTo(x3, yNear); ctx.lineTo(x4, yNear);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fdf6e3';
  const marks = 5;
  for (let i = 0; i < marks; i += 1) {
    const t = i / marks;
    const yA = yFar + (yNear - yFar) * t;
    const yB = yFar + (yNear - yFar) * (t + 0.55 / marks);
    const xa = x1 + (x4 - x1) * t;
    const xb = x2 + (x3 - x2) * t;
    const xc = x1 + (x4 - x1) * (t + 0.55 / marks);
    const xd = x2 + (x3 - x2) * (t + 0.55 / marks);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(xa + (xb - xa) * 0.44, yA); ctx.lineTo(xa + (xb - xa) * 0.56, yA);
    ctx.lineTo(xc + (xd - xc) * 0.56, yB); ctx.lineTo(xc + (xd - xc) * 0.44, yB);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Edge lights.
  ctx.fillStyle = PALETTE.gold;
  for (let i = 0; i <= 6; i += 1) {
    const t = i / 6;
    const y = yFar + (yNear - yFar) * t;
    const lx = x1 + (x4 - x1) * t;
    const rxEdge = x2 + (x3 - x2) * t;
    const r = Math.max(1.4, 3.4 * scaleAt(farRel + (nearRel - farRel) * t));
    ctx.beginPath(); ctx.arc(lx, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rxEdge, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

/** The seaplane from behind: twin floats on V-struts, a wide pod fuselage
 * with a rear hatch and portholes, a swept fin with the Pos Udara roundel, a
 * pusher prop disc and a high wing with coral tips. Drawn big — this is the
 * hero of every frame. */
export function drawPlane(ctx, x, y, scale, bank, pitch, time, onWater) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-bank * 0.2);
  ctx.scale(scale, scale);
  const outline = 'rgba(16, 28, 48, 0.28)';
  // Floats: long, stepped, on proper V-struts.
  for (const fx of [-62, 62]) {
    ctx.strokeStyle = PALETTE.planeShade;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(fx, 92); ctx.lineTo(fx * 0.4, 34);
    ctx.moveTo(fx, 92); ctx.lineTo(fx * 0.62, 30);
    ctx.stroke();
    const fg = ctx.createLinearGradient(fx - 24, 0, fx + 24, 0);
    fg.addColorStop(0, PALETTE.coralDeep);
    fg.addColorStop(0.5, PALETTE.planeAccent);
    fg.addColorStop(1, PALETTE.coralDeep);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(fx - 26, 92);
    ctx.lineTo(fx + 20, 92);
    ctx.quadraticCurveTo(fx + 30, 92, fx + 28, 100);
    ctx.quadraticCurveTo(fx + 24, 110, fx + 6, 110);
    ctx.lineTo(fx - 18, 110);
    ctx.quadraticCurveTo(fx - 28, 108, fx - 26, 92);
    ctx.fill();
  }
  // Horizontal stabilizer with elevator line and coral tips.
  ctx.fillStyle = PALETTE.planeBody;
  rr(ctx, -96, 30, 192, 17, 8);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-96, 41); ctx.lineTo(96, 41); ctx.stroke();
  ctx.fillStyle = PALETTE.planeAccent;
  rr(ctx, -96, 30, 26, 17, 8); ctx.fill();
  rr(ctx, 70, 30, 26, 17, 8); ctx.fill();
  // Fuselage pod: wide shoulders, tapered belly, panel shading.
  const body = ctx.createLinearGradient(-46, 0, 46, 0);
  body.addColorStop(0, PALETTE.planeShade);
  body.addColorStop(0.28, PALETTE.planeBody);
  body.addColorStop(0.5, '#fffdf4');
  body.addColorStop(0.72, PALETTE.planeBody);
  body.addColorStop(1, PALETTE.planeShade);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -72);
  ctx.quadraticCurveTo(40, -68, 45, -6);
  ctx.quadraticCurveTo(47, 44, 30, 78);
  ctx.quadraticCurveTo(16, 96, 0, 96);
  ctx.quadraticCurveTo(-16, 96, -30, 78);
  ctx.quadraticCurveTo(-47, 44, -45, -6);
  ctx.quadraticCurveTo(-40, -68, 0, -72);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Cheatline and the rear cargo hatch, drawn as a panel outline so the tail
  // reads as machinery, never as a face.
  ctx.fillStyle = PALETTE.planeAccent;
  ctx.fillRect(-44, 26, 88, 10);
  ctx.strokeStyle = 'rgba(16, 28, 48, 0.4)';
  ctx.lineWidth = 2;
  rr(ctx, -16, 46, 32, 36, 5);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, 64); ctx.lineTo(14, 64); ctx.stroke();
  // Rear window band high on the pod.
  ctx.fillStyle = '#27436e';
  rr(ctx, -19, -34, 38, 13, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  rr(ctx, -15, -32, 13, 5, 2);
  ctx.fill();
  // Engine nacelle hump behind the wing, with intake.
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.moveTo(-17, -66);
  ctx.quadraticCurveTo(0, -84, 17, -66);
  ctx.lineTo(14, -48);
  ctx.lineTo(-14, -48);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  rr(ctx, -8, -76, 16, 8, 4);
  ctx.fill();
  // Swept fin: coral tip, white roundel, registration.
  const fin = ctx.createLinearGradient(0, -150, 0, -60);
  fin.addColorStop(0, PALETTE.planeAccent);
  fin.addColorStop(0.42, PALETTE.planeAccent);
  fin.addColorStop(0.45, PALETTE.planeBody);
  fin.addColorStop(1, PALETTE.planeBody);
  ctx.fillStyle = fin;
  ctx.beginPath();
  ctx.moveTo(-14, -58);
  ctx.quadraticCurveTo(-12, -104, 2, -146);
  ctx.quadraticCurveTo(5, -152, 9, -148);
  ctx.lineTo(15, -58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, -140); ctx.lineTo(13, -66); ctx.stroke();
  ctx.fillStyle = PALETTE.cream;
  ctx.beginPath(); ctx.arc(1, -118, 7.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.coralDeep;
  ctx.beginPath(); ctx.arc(1, -118, 4.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.tealDeep;
  ctx.beginPath(); ctx.arc(1, -118, 2, 0, Math.PI * 2); ctx.fill();
  // Pusher prop disc, behind the nacelle.
  ctx.save();
  ctx.globalAlpha = onWater ? 0.13 : 0.22;
  ctx.fillStyle = '#2c2c34';
  ctx.beginPath(); ctx.ellipse(0, -38, 17, 56, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(30,30,38,0.4)';
  ctx.lineWidth = 3.4;
  const pa = time * 43;
  for (let i = 0; i < 3; i += 1) {
    const a = pa + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(0, -38);
    ctx.lineTo(Math.sin(a) * 15, -38 + Math.cos(a) * 53);
    ctx.stroke();
  }
  // High wing: shaded underside, aileron lines, coral tips.
  const wing = ctx.createLinearGradient(0, -64, 0, -28);
  wing.addColorStop(0, '#fffdf4');
  wing.addColorStop(0.75, PALETTE.planeBody);
  wing.addColorStop(1, PALETTE.planeShade);
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(-182, -46);
  ctx.lineTo(-32, -62);
  ctx.lineTo(32, -62);
  ctx.lineTo(182, -46);
  ctx.lineTo(176, -27);
  ctx.lineTo(30, -41);
  ctx.lineTo(-30, -41);
  ctx.lineTo(-176, -27);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-118, -52); ctx.lineTo(-114, -34);
  ctx.moveTo(118, -52); ctx.lineTo(114, -34);
  ctx.moveTo(-58, -58); ctx.lineTo(-56, -39);
  ctx.moveTo(58, -58); ctx.lineTo(56, -39);
  ctx.stroke();
  ctx.fillStyle = PALETTE.planeAccent;
  rr(ctx, -182, -46, 24, 19, 7); ctx.fill();
  rr(ctx, 158, -46, 24, 19, 7); ctx.fill();
  // Wing struts, running to the lower fuselage.
  ctx.strokeStyle = PALETTE.planeShade;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-58, -40); ctx.lineTo(-27, 52);
  ctx.moveTo(58, -40); ctx.lineTo(27, 52);
  ctx.stroke();
  // Navigation lights.
  ctx.fillStyle = '#ff5964';
  ctx.beginPath(); ctx.arc(-178, -36, 4.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6bf178';
  ctx.beginPath(); ctx.arc(178, -36, 4.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawGauge(ctx, x, y, r, label, value, digital, needle01, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 18, 32, 0.92)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = PALETTE.cream;
  ctx.lineWidth = 1.6;
  for (let i = 0; i <= 10; i += 1) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const inner = i % 5 === 0 ? r * 0.68 : r * 0.78;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    ctx.lineTo(x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88);
    ctx.stroke();
  }
  const na = Math.PI * 0.75 + clamp(needle01, 0, 1) * Math.PI * 1.5;
  ctx.strokeStyle = color || PALETTE.coral;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(na) * r * 0.72, y + Math.sin(na) * r * 0.72);
  ctx.stroke();
  ctx.fillStyle = PALETTE.cream;
  ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '700 10px Verdana, sans-serif';
  ctx.fillText(label, x, y - r - 6);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = '900 15px Verdana, sans-serif';
  ctx.fillText(digital, x, y + r * 0.62);
  ctx.restore();
  return value;
}

function drawAttitude(ctx, x, y, r, bank, pitch) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-bank * 0.5);
  ctx.translate(0, pitch * r * 0.55);
  ctx.fillStyle = '#3d8fa3';
  ctx.fillRect(-r, -r * 2, r * 2, r * 2);
  ctx.fillStyle = '#7a4a2b';
  ctx.fillRect(-r, 0, r * 2, r * 2);
  ctx.strokeStyle = PALETTE.cream;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
  for (const off of [-0.36, 0.36]) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, off * r);
    ctx.lineTo(r * 0.22, off * r);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.52, y);
  ctx.lineTo(x - r * 0.16, y);
  ctx.lineTo(x, y + r * 0.16);
  ctx.lineTo(x + r * 0.16, y);
  ctx.lineTo(x + r * 0.52, y);
  ctx.stroke();
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '700 10px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATT', x, y - r - 6);
  ctx.restore();
}

function bar(ctx, x, y, w, label, ratio, color, warn) {
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '700 10px Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y + 3);
  ctx.fillStyle = 'rgba(254,246,228,0.16)';
  rr(ctx, x + 40, y - 6, w, 11, 5);
  ctx.fill();
  ctx.fillStyle = warn && Math.floor(performance.now() / 400) % 2 === 0 ? PALETTE.bad : color;
  if (ratio > 0.01) {
    rr(ctx, x + 40, y - 6, Math.max(6, w * clamp(ratio, 0, 1)), 11, 5);
    ctx.fill();
  }
}

/** The full flight view: scene, plane, HUD and scheme controls. */
export function drawFlightScene(ctx, view) {
  const { flight: f, leg, time } = view;
  ctx.fillStyle = skyGradient(ctx);
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  drawSun(ctx, time);
  drawFarIslands(ctx, f, leg.seed);
  drawSea(ctx, f, time);
  drawScenery(ctx, f, leg);
  drawClouds(ctx, f, leg, time);
  const sortedStorms = [...leg.storms].sort((a, b) => b.dist - a.dist);
  for (const storm of sortedStorms) drawStorm(ctx, f, leg, storm, time);
  drawRunway(ctx, f, leg);
  const sortedRings = [...leg.rings].sort((a, b) => b.dist - a.dist);
  for (const ring of sortedRings) drawRing(ctx, f, ring, time);
  for (const flock of leg.flocks) drawBirds(ctx, f, leg, flock, time);
  // Plane shadow on the water.
  if (f.phase !== 'roll') {
    const shY = projY(f.alt, 0, 26, 0);
    const shScale = clamp(1 - f.alt / 300, 0.25, 1);
    ctx.globalAlpha = 0.26 * shScale;
    ctx.fillStyle = '#06222e';
    ctx.beginPath();
    ctx.ellipse(CX, Math.min(shY, 706), 120 * shScale + 30, 13 * shScale + 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  const bobbing = f.phase === 'roll' ? Math.sin(time * 2.2) * 2.4 : 0;
  drawPlane(ctx, CX - f.bankVis * 26, 452 + f.pitchVis * -15 + bobbing, 1.28, f.bankVis, f.pitchVis, time, f.phase === 'roll');
  if (f.phase === 'roll') {
    // Spray behind the floats on the takeoff roll.
    ctx.strokeStyle = 'rgba(254,246,228,0.65)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i += 1) {
      const rng = makeRng(i * 17 + Math.floor(time * 14));
      const sx = CX + (rng.next() - 0.5) * 150;
      ctx.beginPath();
      ctx.moveTo(sx, 566 + rng.next() * 8);
      ctx.lineTo(sx + (rng.next() - 0.5) * 30, 566 - rng.next() * 26);
      ctx.stroke();
    }
  }
  if (view.dim) {
    ctx.fillStyle = `rgba(8, 12, 24, ${view.dim})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  if (!view.bare) drawHUD(ctx, view);
  if (f.inStorm) drawRainOverlay(ctx, time);
}

function drawRainOverlay(ctx, time) {
  ctx.strokeStyle = 'rgba(168, 218, 220, 0.4)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 42; i += 1) {
    const rng = makeRng(i * 41 + Math.floor(time * 11));
    const x = rng.next() * VIEW.width;
    const y = rng.next() * 560;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 7, y + 26);
    ctx.stroke();
  }
}

function drawHUD(ctx, view) {
  const { flight: f, leg, ticket, time } = view;
  // Bottom instrument panel.
  const panelGrad = ctx.createLinearGradient(0, 602, 0, 720);
  panelGrad.addColorStop(0, 'rgba(16, 28, 48, 0.94)');
  panelGrad.addColorStop(1, 'rgba(8, 14, 26, 0.97)');
  ctx.fillStyle = panelGrad;
  ctx.fillRect(0, 602, VIEW.width, 118);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(0, 602, VIEW.width, 3);
  // Score block.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '700 11px Verdana, sans-serif';
  ctx.fillText('SCORE', 30, 632);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = '900 30px Verdana, sans-serif';
  ctx.fillText(String(f.score).padStart(5, '0'), 28, 664);
  // Ring pips.
  leg.rings.forEach((ring, i) => {
    const x = 34 + i * 26;
    ctx.beginPath();
    ctx.arc(x, 692, 8, 0, Math.PI * 2);
    if (ring.scored === 1 || ring.scored === 2) { ctx.fillStyle = PALETTE.teal; ctx.fill(); }
    else if (ring.scored === 3) { ctx.fillStyle = PALETTE.gold; ctx.fill(); }
    else if (ring.scored === 4) { ctx.fillStyle = 'rgba(239,100,97,0.7)'; ctx.fill(); }
    else { ctx.strokeStyle = PALETTE.muted; ctx.lineWidth = 2; ctx.stroke(); }
  });
  if (view.streak >= 2) {
    drawChallengeIcon(ctx, 'flame', 196, 660, 30, PALETTE.gold);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '900 17px Verdana, sans-serif';
    ctx.fillText(`×${view.streak}`, 216, 667);
  }
  // Gauges.
  const knots = Math.round(f.speed * 1.94);
  drawGauge(ctx, 330, 664, 42, 'AIRSPEED', knots, `${knots} KT`, f.speed / 75);
  drawAttitude(ctx, 640, 664, 42, f.bankVis, f.pitchVis);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '700 10px Verdana, sans-serif';
  ctx.textAlign = 'center';
  const hdg = ((90 + Math.round(f.bankVis * 26)) % 360 + 360) % 360;
  ctx.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, 640, 716);
  const feet = Math.round(f.alt * 3.28);
  drawGauge(ctx, 950, 664, 42, 'ALTITUDE', feet, `${feet} FT`, f.alt / 280, PALETTE.tealDeep);
  // Bars between ASI and ATT, and right of ALT.
  bar(ctx, 408, 640, 92, 'FUEL', f.fuel / view.fuelCapacity, PALETTE.teal, f.fuel < 22);
  bar(ctx, 408, 668, 92, 'HULL', f.hull / view.maxHull, PALETTE.good, f.hull < 30);
  bar(ctx, 408, 696, 92, 'THR', f.throttle, PALETTE.gold, false);
  // Cash + countdown.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '700 11px Verdana, sans-serif';
  ctx.fillText('CASH', 1250, 632);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '900 24px Verdana, sans-serif';
  ctx.fillText(`$${view.cash}`, 1250, 660);
  if (view.countdown !== null && view.countdown !== undefined) {
    const left = Math.max(0, view.countdown);
    const mm = Math.floor(left / 60);
    const ss = String(Math.floor(left % 60)).padStart(2, '0');
    ctx.fillStyle = left < 15 ? PALETTE.bad : PALETTE.cream;
    ctx.font = '900 20px Verdana, sans-serif';
    const timeText = `${mm}:${ss}`;
    ctx.fillText(timeText, 1250, 690);
    // A drawn stopwatch glyph beside the numbers.
    const tw = ctx.measureText(timeText).width;
    const clockX = 1250 - tw - 18;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(clockX, 683, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(clockX, 683); ctx.lineTo(clockX, 677);
    ctx.moveTo(clockX, 683); ctx.lineTo(clockX + 4.4, 685);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(clockX - 3, 671); ctx.lineTo(clockX + 3, 671); ctx.stroke();
  }
  // Cargo banner, top-left.
  if (ticket) {
    ctx.fillStyle = PALETTE.panel;
    const label = `${ticket.cargoName} — ${ticket.customer}`;
    ctx.font = '900 16px Verdana, sans-serif';
    const w = ctx.measureText(label).width + 96;
    rr(ctx, 22, 20, w, 46, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    drawCargoIcon(ctx, ticket.icon, 48, 43, 30, PALETTE.gold);
    ctx.fillStyle = PALETTE.cream;
    ctx.textAlign = 'left';
    ctx.fillText(label, 70, 41);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '700 11.5px Verdana, sans-serif';
    ctx.fillText(`${leg.origin.name} → ${leg.dest.name} · ${Math.max(0, Math.round(leg.length - f.dist))} m`, 70, 59);
  }
  // NEXT goal, top-right.
  ctx.fillStyle = PALETTE.panelSoft;
  ctx.font = '700 12.5px Verdana, sans-serif';
  const goal = view.nextGoal || '';
  const gw = ctx.measureText(goal).width + 28;
  rr(ctx, VIEW.width - 22 - gw, 20, gw, 32, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.horizon;
  ctx.textAlign = 'left';
  ctx.fillText(goal, VIEW.width - 22 - gw + 14, 41);
  // Scheme chip, bottom-right above the panel.
  const scheme = view.scheme || 'keyboard';
  ctx.fillStyle = PALETTE.panelSoft;
  rr(ctx, VIEW.width - 178, 556, 156, 36, 10);
  ctx.fill();
  drawControlIcon(ctx, scheme, VIEW.width - 152, 574, 24, PALETTE.gold);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = '900 12px Verdana, sans-serif';
  ctx.fillText(scheme.toUpperCase(), VIEW.width - 132, 579);
  // Warnings.
  ctx.textAlign = 'center';
  if (f.stall && f.phase === 'air') {
    if (Math.floor(time * 2.4) % 2 === 0) {
      ctx.fillStyle = PALETTE.bad;
      ctx.font = '900 30px Verdana, sans-serif';
      ctx.fillText('STALL', CX, 120);
    }
  } else if (f.inStorm) {
    ctx.fillStyle = PALETTE.rain;
    ctx.font = '900 21px Verdana, sans-serif';
    ctx.fillText('— STORM CELL —', CX, 116);
  } else if (f.phase === 'roll') {
    ctx.fillStyle = PALETTE.cream;
    ctx.font = '900 19px Verdana, sans-serif';
    ctx.fillText(f.speed > 18 ? 'PULL UP — TARIK!' : 'THROTTLE UP — GAS PENUH!', CX, 116);
  }
  // Popups.
  for (const pop of view.popups || []) {
    const age = time - pop.t;
    if (age < 0 || age > 1.5) continue;
    ctx.globalAlpha = 1 - age / 1.5;
    ctx.fillStyle = pop.color;
    ctx.font = '900 22px Verdana, sans-serif';
    ctx.fillText(pop.text, pop.x, pop.y - age * 44);
  }
  ctx.globalAlpha = 1;
  drawSchemeControls(ctx, view);
}

/** On-screen controls for the pointer schemes, drawn over the flight view. */
export function drawSchemeControls(ctx, view) {
  const controls = view.controls;
  if (!controls || view.screen !== 'flight') return;
  const scheme = view.scheme;
  if (scheme === 'joystick') {
    const st = controls.stickState();
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(13, 24, 43, 0.55)';
    ctx.beginPath(); ctx.arc(STICK.x, STICK.y, STICK.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = PALETTE.cream;
    ctx.lineWidth = 2;
    ctx.stroke();
    const kx = STICK.x + clamp(st.dx, -STICK.r, STICK.r) * 0.72;
    const ky = STICK.y + clamp(st.dy, -STICK.r, STICK.r) * 0.72;
    const knobGrad = ctx.createRadialGradient(kx - 8, ky - 8, 4, kx, ky, STICK.knob);
    knobGrad.addColorStop(0, '#ffd9a0');
    knobGrad.addColorStop(1, PALETTE.coralDeep);
    ctx.fillStyle = knobGrad;
    ctx.beginPath(); ctx.arc(kx, ky, STICK.knob, 0, Math.PI * 2); ctx.fill();
    // Throttle slider.
    const sl = THROTTLE_SLIDER;
    ctx.fillStyle = 'rgba(13, 24, 43, 0.55)';
    rr(ctx, sl.x - 16, sl.y - 26, sl.w + 32, sl.h + 58, 14);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '900 11px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THR', sl.x + sl.w / 2, sl.y - 10);
    ctx.fillStyle = 'rgba(254,246,228,0.25)';
    rr(ctx, sl.x + sl.w / 2 - 4, sl.y, 8, sl.h, 4);
    ctx.fill();
    const val = controls.sliderState().value !== null && controls.sliderState().value !== undefined ? controls.sliderState().value : view.flight.throttle;
    const hy = sl.y + (1 - val) * sl.h;
    ctx.fillStyle = PALETTE.gold;
    rr(ctx, sl.x - 4, hy - 11, sl.w + 8, 22, 8);
    ctx.fill();
    ctx.restore();
  } else if (scheme === 'touch') {
    const zones = controls.touchState();
    ctx.save();
    for (const z of TOUCH_ZONES) {
      ctx.fillStyle = zones[z.id] ? 'rgba(255, 183, 3, 0.5)' : 'rgba(13, 24, 43, 0.5)';
      rr(ctx, z.x, z.y, z.w, z.h, 16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(254,246,228,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = PALETTE.cream;
      ctx.font = z.label.length > 2 ? '900 17px Verdana, sans-serif' : '900 30px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(z.label, z.x + z.w / 2, z.y + z.h / 2 + (z.label.length > 2 ? 6 : 11));
    }
    ctx.restore();
  } else if (scheme === 'gyro') {
    ctx.save();
    ctx.fillStyle = PALETTE.panelSoft;
    rr(ctx, CX - 128, 556, 256, 36, 10);
    ctx.fill();
    drawControlIcon(ctx, 'gyro', CX - 104, 574, 24, PALETTE.gold);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = '900 12px Verdana, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(controls.gyroCalibrated() ? 'GYRO LIVE — TILT TO FLY' : 'GYRO — TAP TO CALIBRATE', CX - 84, 579);
    ctx.restore();
  }
}
