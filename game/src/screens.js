// Every screen that is not the flight itself: the poster title, the morning
// ticket board, the hangar with its campaign map and upgrade cards, the
// CONTROLS screen with its four scheme cards, how-to-play, challenges, pilot
// stats, settings, pause and the DELIVERED receipt. Screens draw and register
// button hit-boxes; main.js owns the state and the clicks.

import { ISLANDS, PALETTE, SEASONS, VIEW } from './config.js';
import { CHALLENGES, UPGRADES, challengeProgress, nextGoal, stampCount, upgradeLevel, upgradePrice } from './campaign.js';
import { SCHEMES, gyroSupported, schemeById } from './controls.js';
import { drawCargoIcon, drawChallengeIcon, drawControlIcon, drawLock, drawStamp, drawUpgradeIcon, rr } from './icons.js';
import { storyNote } from './orders.js';

const CX = VIEW.width / 2;

export function makeHitList() {
  return { hits: [] };
}

export function hitTest(list, x, y) {
  for (let i = list.hits.length - 1; i >= 0; i -= 1) {
    const h = list.hits[i];
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.id;
  }
  return null;
}

function T(ctx, str, x, y, font, color, align = 'left') {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}

function tracked(ctx, str, x, y, font, color, spacing) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  let total = 0;
  for (const ch of str) total += ctx.measureText(ch).width + spacing;
  total -= spacing;
  let cx = x - total / 2;
  for (const ch of str) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return total;
}

function panel(ctx, x, y, w, h, fill = PALETTE.panel) {
  ctx.fillStyle = fill;
  rr(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 183, 3, 0.55)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function button(ctx, list, id, x, y, w, h, label, opts = {}) {
  const primary = opts.primary;
  ctx.fillStyle = primary ? PALETTE.gold : 'rgba(254, 246, 228, 0.1)';
  rr(ctx, x, y, w, h, 12);
  ctx.fill();
  if (!primary) {
    ctx.strokeStyle = 'rgba(254, 246, 228, 0.5)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  T(ctx, label, x + w / 2, y + h / 2 + (opts.size || 17) * 0.36, `900 ${opts.size || 17}px Verdana, sans-serif`, primary ? PALETTE.ink : PALETTE.cream, 'center');
  list.hits.push({ id, x, y, w, h });
}

function header(ctx, title, sub) {
  tracked(ctx, title, CX, 86, '900 40px Verdana, sans-serif', PALETTE.cream, 3);
  if (sub) T(ctx, sub, CX, 118, '700 15px Verdana, sans-serif', PALETTE.horizon, 'center');
}

function backButton(ctx, list) {
  button(ctx, list, 'back', 30, 640, 150, 52, '◀ BACK');
}

/** Dim the live scene behind a screen. */
export function dimScene(ctx, alpha) {
  ctx.fillStyle = `rgba(8, 13, 26, ${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

/* ------------------------------- TITLE ------------------------------- */

export function drawTitle(ctx, list, S) {
  dimScene(ctx, 0.18);
  // Sun-disc behind the title.
  ctx.fillStyle = 'rgba(255, 183, 3, 0.9)';
  ctx.beginPath(); ctx.arc(CX, 208, 86, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.coralDeep;
  ctx.beginPath(); ctx.arc(CX, 208, 86, 0, Math.PI, Math.PI * 2); ctx.fill();
  tracked(ctx, 'SENJA HOPPER', CX, 226, '900 84px Verdana, sans-serif', PALETTE.cream, 6);
  ctx.fillStyle = PALETTE.gold;
  rr(ctx, CX - 252, 248, 504, 34, 8);
  ctx.fill();
  T(ctx, 'P O S   U D A R A  ·  ARCHIPELAGO AIR MAIL', CX, 271, '900 16px Verdana, sans-serif', PALETTE.ink, 'center');
  T(ctx, 'Fly the mail. Thread the rings. Earn every stamp from Bali to Papua.', CX, 322, '700 16px Verdana, sans-serif', PALETTE.cream, 'center');
  const bw = 300;
  const bx = CX - bw / 2;
  let y = 356;
  if (S.save.started) {
    button(ctx, list, 'continue', bx, y, bw, 56, `CONTINUE — DAY ${S.save.day}`, { primary: true, size: 19 });
    y += 68;
  }
  button(ctx, list, 'newgame', bx, y, bw, 56, S.save.started ? 'NEW GAME' : '▶  NEW GAME', { primary: !S.save.started, size: 19 });
  y += 68;
  button(ctx, list, 'howto', bx, y, bw, 48, 'HOW TO PLAY');
  y += 58;
  button(ctx, list, 'controls', bx, y, bw, 48, 'CONTROLS');
  y += 58;
  const half = (bw - 10) / 2;
  button(ctx, list, 'challenges', bx, y, half, 48, 'CHALLENGES', { size: 14 });
  button(ctx, list, 'stats', bx + half + 10, y, half, 48, 'PILOT STATS', { size: 14 });
  y += 58;
  button(ctx, list, 'settings', bx, y, bw, 48, 'SETTINGS');
  T(ctx, nextGoal(S.save), CX, 700, '700 13px Verdana, sans-serif', PALETTE.horizon, 'center');
}

/* ----------------------------- HOW TO PLAY ----------------------------- */

const SCHEME_HELP = {
  keyboard: ['ARROWS — pitch & bank', 'W / S — throttle up & down', 'SPACE — confirm · ESC — pause'],
  joystick: ['DRAG THE STICK — pitch & bank', 'SLIDE THR — throttle', 'Works with mouse or finger'],
  touch: ['▲ ▼ — pitch · ◀ ▶ — bank', 'THR + / − — throttle', 'Big buttons, both thumbs'],
  gyro: ['TILT FORWARD / BACK — pitch', 'TILT LEFT / RIGHT — bank', 'W / S or buttons — throttle · calibrate in CONTROLS'],
};

export function drawHowTo(ctx, list, S) {
  dimScene(ctx, 0.55);
  header(ctx, 'HOW TO PLAY', 'Cara main — one week, eight islands, every stamp earned');
  panel(ctx, 90, 140, 1100, 470);
  const x = 130;
  let y = 196;
  T(ctx, 'THE JOB', x, y, '900 19px Verdana, sans-serif', PALETTE.gold);
  y += 30;
  for (const line of [
    'Each morning pick a ticket at the board: a named customer, a story in the hold.',
    'Take off on the water, thread the golden rings, mind the storm cells and birds.',
    'Land on the far strip — soft, centred, at approach speed — for grade S pay.',
    'Stamps unlock the next island east. Upgrades make the plane yours.',
  ]) {
    T(ctx, '·  ' + line, x, y, '400 16.5px Verdana, sans-serif', PALETTE.cream);
    y += 27;
  }
  y += 14;
  const scheme = schemeById(S.save.scheme);
  T(ctx, `FLYING WITH: ${scheme.name}`, x, y, '900 19px Verdana, sans-serif', PALETTE.gold);
  drawControlIcon(ctx, scheme.id, x + 316, y - 8, 34, PALETTE.gold);
  y += 32;
  for (const line of SCHEME_HELP[scheme.id]) {
    T(ctx, '·  ' + line, x, y, '400 16.5px Verdana, sans-serif', PALETTE.cream);
    y += 27;
  }
  y += 12;
  T(ctx, 'GRADES', x, y, '900 19px Verdana, sans-serif', PALETTE.gold);
  y += 30;
  T(ctx, '·  S ×1.5 pay · A ×1.25 · B ×1.0 · C ×0.8 · D ×0.6 — late halves the base. Rings pay on top.', x, y, '400 16.5px Verdana, sans-serif', PALETTE.cream);
  button(ctx, list, 'controls', 830, 540, 300, 54, 'CHANGE CONTROLS');
  backButton(ctx, list);
}

/* ------------------------------ CONTROLS ------------------------------ */

export function drawControls(ctx, list, S) {
  dimScene(ctx, 0.62);
  header(ctx, 'CONTROLS', 'Kontrol — pick how you fly. Change anytime, even mid-flight from pause.');
  const cardW = 268;
  const gap = 18;
  const x0 = (VIEW.width - (cardW * 4 + gap * 3)) / 2;
  const y0 = 150;
  SCHEMES.forEach((scheme, i) => {
    const x = x0 + i * (cardW + gap);
    const active = S.save.scheme === scheme.id;
    const unavailable = scheme.id === 'gyro' && !gyroSupported() && !S.gyroForced;
    ctx.fillStyle = active ? 'rgba(255, 183, 3, 0.16)' : PALETTE.panel;
    rr(ctx, x, y0, cardW, 356, 16);
    ctx.fill();
    ctx.strokeStyle = active ? PALETTE.gold : 'rgba(254,246,228,0.35)';
    ctx.lineWidth = active ? 3 : 1.6;
    ctx.stroke();
    drawControlIcon(ctx, scheme.id, x + cardW / 2, y0 + 84, 96, active ? PALETTE.gold : PALETTE.cream);
    T(ctx, scheme.name, x + cardW / 2, y0 + 168, '900 24px Verdana, sans-serif', PALETTE.cream, 'center');
    T(ctx, scheme.nameId, x + cardW / 2, y0 + 194, '700 13px Verdana, sans-serif', PALETTE.horizon, 'center');
    const words = scheme.blurb.split('·');
    words.forEach((w, wi) => {
      T(ctx, w.trim(), x + cardW / 2, y0 + 232 + wi * 22, '400 13.5px Verdana, sans-serif', PALETTE.muted, 'center');
    });
    if (unavailable) {
      T(ctx, 'NOT AVAILABLE', x + cardW / 2, y0 + 322, '900 15px Verdana, sans-serif', PALETTE.bad, 'center');
      T(ctx, 'ON THIS DEVICE', x + cardW / 2, y0 + 342, '900 15px Verdana, sans-serif', PALETTE.bad, 'center');
    } else if (active) {
      ctx.fillStyle = PALETTE.gold;
      rr(ctx, x + 44, y0 + 296, cardW - 88, 40, 10);
      ctx.fill();
      T(ctx, '● ACTIVE', x + cardW / 2, y0 + 322, '900 15px Verdana, sans-serif', PALETTE.ink, 'center');
    } else {
      button(ctx, list, `scheme:${scheme.id}`, x + 44, y0 + 296, cardW - 88, 40, scheme.id === 'gyro' ? 'TAP TO ENABLE' : 'USE THIS', { size: 14 });
    }
  });
  // Gyro extras when gyro is the live scheme.
  if (S.save.scheme === 'gyro') {
    panel(ctx, 290, 528, 700, 76, PALETTE.panelSoft);
    T(ctx, 'GYRO SENSITIVITY', 316, 560, '900 14px Verdana, sans-serif', PALETTE.cream);
    for (const [i, label] of ['CALM', 'STD', 'HOT'].entries()) {
      const sel = Math.round((S.save.gyroSensitivity || 1) * 2) - 1 === i || (i === 1 && (S.save.gyroSensitivity || 1) === 1);
      button(ctx, list, `gyrosens:${[0.7, 1, 1.45][i]}`, 316 + i * 118, 568, 106, 30, label, { size: 12, primary: sel });
    }
    button(ctx, list, 'gyrocal', 700, 552, 264, 40, '◎ CALIBRATE NEUTRAL', { size: 13 });
  } else {
    T(ctx, 'All four schemes steer the same plane — throttle, pitch and bank are identical underneath.', CX, 566, '400 15px Verdana, sans-serif', PALETTE.muted, 'center');
  }
  backButton(ctx, list);
}

/* ----------------------------- CHALLENGES ----------------------------- */

export function drawChallenges(ctx, list, S) {
  dimScene(ctx, 0.55);
  header(ctx, 'CHALLENGES', 'Tantangan — the hangar wall of honour');
  let y = 148;
  for (const ch of CHALLENGES) {
    const progress = challengeProgress(S.save, ch.id);
    const done = progress >= ch.target;
    panel(ctx, 190, y, 900, 72, done ? 'rgba(34, 184, 166, 0.2)' : PALETTE.panelSoft);
    drawChallengeIcon(ctx, ch.icon, 238, y + 36, 40, done ? PALETTE.teal : PALETTE.gold);
    T(ctx, ch.name, 272, y + 32, '900 17px Verdana, sans-serif', PALETTE.cream);
    T(ctx, ch.desc, 272, y + 56, '400 13.5px Verdana, sans-serif', PALETTE.muted);
    ctx.fillStyle = 'rgba(254,246,228,0.15)';
    rr(ctx, 760, y + 26, 220, 16, 8);
    ctx.fill();
    ctx.fillStyle = done ? PALETTE.teal : PALETTE.gold;
    if (progress > 0) { rr(ctx, 760, y + 26, Math.max(14, 220 * (progress / ch.target)), 16, 8); ctx.fill(); }
    T(ctx, done ? 'DONE ✓' : `${progress}/${ch.target}`, 1030, y + 41, '900 15px Verdana, sans-serif', done ? PALETTE.teal : PALETTE.cream, 'center');
    y += 84;
  }
  backButton(ctx, list);
}

/* ------------------------------- STATS ------------------------------- */

export function drawStats(ctx, list, S) {
  dimScene(ctx, 0.55);
  header(ctx, 'PILOT STATS', 'Statistik pilot — the logbook');
  const st = S.save.stats;
  const rows = [
    ['FLIGHTS FLOWN', st.flights],
    ['DELIVERIES LANDED', st.delivered],
    ['DITCHED AT SEA', st.ditched],
    ['RINGS THREADED', st.rings],
    ['S-GRADE LANDINGS', st.perfect],
    ['BEST STREAK', `×${st.bestStreak}`],
    ['TOTAL EARNED', `$${st.earned}`],
    ['DAY ON THE ROUTE', S.save.day],
  ];
  let y = 158;
  rows.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? 190 : 660;
    if (i % 2 === 0 && i > 0) y += 76;
    panel(ctx, x, y, 430, 62, PALETTE.panelSoft);
    T(ctx, label, x + 22, y + 26, '700 12px Verdana, sans-serif', PALETTE.muted);
    T(ctx, String(value), x + 22, y + 52, '900 22px Verdana, sans-serif', PALETTE.cream);
  });
  T(ctx, `STAMP COLLECTION — ${stampCount(S.save)}/${ISLANDS.length - 1}`, 190, 486, '900 16px Verdana, sans-serif', PALETTE.gold);
  ISLANDS.slice(1).forEach((island, i) => {
    const x = 190 + i * 128;
    const grade = S.save.stamps[island.id];
    ctx.fillStyle = PALETTE.panelSoft;
    rr(ctx, x, 502, 116, 108, 12);
    ctx.fill();
    if (grade) {
      drawStamp(ctx, x + 58, 544, 30, island.name, grade, -0.16);
    } else {
      T(ctx, '?', x + 58, 556, '900 30px Verdana, sans-serif', PALETTE.muted, 'center');
    }
    T(ctx, island.name, x + 58, 598, '700 10.5px Verdana, sans-serif', PALETTE.cream, 'center');
  });
  backButton(ctx, list);
}

/* ------------------------------ SETTINGS ------------------------------ */

export function drawSettings(ctx, list, S) {
  dimScene(ctx, 0.55);
  header(ctx, 'SETTINGS', 'Pengaturan — season, sound and save');
  T(ctx, 'SEASON — MUSIM', 190, 176, '900 16px Verdana, sans-serif', PALETTE.gold);
  SEASONS.forEach((season, i) => {
    const x = 190 + i * 306;
    const active = S.save.season === i;
    ctx.fillStyle = active ? 'rgba(255,183,3,0.16)' : PALETTE.panelSoft;
    rr(ctx, x, 192, 288, 108, 14);
    ctx.fill();
    ctx.strokeStyle = active ? PALETTE.gold : 'rgba(254,246,228,0.3)';
    ctx.lineWidth = active ? 3 : 1.5;
    ctx.stroke();
    T(ctx, season.name, x + 18, 226, '900 16px Verdana, sans-serif', PALETTE.cream);
    T(ctx, season.en, x + 18, 248, '400 13px Verdana, sans-serif', PALETTE.muted);
    T(ctx, `Pay ×${season.pay} · gusts ×${season.gust}`, x + 18, 278, '700 13px Verdana, sans-serif', PALETTE.horizon);
    list.hits.push({ id: `season:${i}`, x, y: 192, w: 288, h: 108 });
  });
  T(ctx, 'SOUND — SUARA', 190, 348, '900 16px Verdana, sans-serif', PALETTE.gold);
  button(ctx, list, 'sound', 190, 364, 220, 50, S.save.sound ? 'SOUND: ON' : 'SOUND: OFF', { primary: S.save.sound });
  T(ctx, 'CONTROL SCHEME', 470, 348, '900 16px Verdana, sans-serif', PALETTE.gold);
  button(ctx, list, 'controls', 470, 364, 300, 50, `NOW: ${schemeById(S.save.scheme).name} — CHANGE`);
  T(ctx, 'DANGER — BAHAYA', 190, 470, '900 16px Verdana, sans-serif', PALETTE.bad);
  button(ctx, list, 'reset', 190, 486, 300, 50, 'RESET SAVE / MULAI BARU');
  T(ctx, 'Wipes stamps, cash, upgrades and stats. The route forgets you.', 510, 518, '400 14px Verdana, sans-serif', PALETTE.muted);
  backButton(ctx, list);
}

/* ---------------------------- MORNING BOARD ---------------------------- */

export function drawBoard(ctx, list, S) {
  dimScene(ctx, 0.5);
  const here = ISLANDS[S.save.atIsland];
  header(ctx, `DAY ${S.save.day} — MORNING BOARD`, `Papan pagi · ${here.field} · $${S.save.cash} in the tin`);
  const tickets = S.board;
  tickets.forEach((ticket, i) => {
    const x = 70 + i * 396;
    const y = 150;
    const selected = S.selectedTicket === i;
    ctx.fillStyle = selected ? 'rgba(255,183,3,0.15)' : PALETTE.panel;
    rr(ctx, x, y, 372, 356, 16);
    ctx.fill();
    ctx.strokeStyle = selected ? PALETTE.gold : 'rgba(254,246,228,0.3)';
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.stroke();
    drawCargoIcon(ctx, ticket.icon, x + 52, y + 54, 56, PALETTE.gold);
    T(ctx, ticket.cargoNameId, x + 92, y + 48, '900 15px Verdana, sans-serif', PALETTE.horizon);
    const cargoLines = ticket.cargoName.split(' ');
    T(ctx, ticket.cargoName, x + 92, y + 70, '900 13px Verdana, sans-serif', PALETTE.cream);
    void cargoLines;
    T(ctx, `${ticket.customer} — ${ticket.role}`, x + 26, y + 116, '700 15px Verdana, sans-serif', PALETTE.cream);
    T(ctx, `${ISLANDS[ticket.from].name} → ${ISLANDS[ticket.to].name}`, x + 26, y + 152, '900 19px Verdana, sans-serif', PALETTE.cream);
    T(ctx, `${ISLANDS[ticket.to].field}`, x + 26, y + 176, '400 13px Verdana, sans-serif', PALETTE.muted);
    // Weather pips.
    T(ctx, 'WEATHER', x + 26, y + 214, '700 11px Verdana, sans-serif', PALETTE.muted);
    for (let w = 0; w < 3; w += 1) {
      ctx.fillStyle = w < ticket.weather ? PALETTE.coral : 'rgba(254,246,228,0.18)';
      ctx.beginPath(); ctx.arc(x + 34 + w * 24, y + 236, 8, 0, Math.PI * 2); ctx.fill();
    }
    T(ctx, ticket.weather === 1 ? 'Calm' : ticket.weather === 2 ? 'Breezy' : 'Stormy', x + 116, y + 241, '700 13px Verdana, sans-serif', PALETTE.cream);
    T(ctx, `PAY $${ticket.basePay}`, x + 26, y + 292, '900 24px Verdana, sans-serif', PALETTE.gold);
    T(ctx, `CLOCK ${Math.floor(ticket.clock / 60)}:${String(ticket.clock % 60).padStart(2, '0')} before pay decays`, x + 26, y + 318, '400 12.5px Verdana, sans-serif', PALETTE.muted);
    if (ticket.fragile) T(ctx, 'FRAGILE — land her soft', x + 26, y + 340, '700 12.5px Verdana, sans-serif', PALETTE.coral);
    list.hits.push({ id: `ticket:${i}`, x, y, w: 372, h: 356 });
  });
  const note = S.selectedTicket !== null && S.selectedTicket !== undefined ? storyNote(tickets[S.selectedTicket]) : null;
  if (note) T(ctx, `"${note}"`, CX, 536, 'italic 700 15px Verdana, sans-serif', PALETTE.horizon, 'center');
  // Pre-flight choice + fly.
  if (S.selectedTicket !== null && S.selectedTicket !== undefined) {
    const fuelSel = S.preflight === 'fuel';
    button(ctx, list, 'preflight:fuel', 240, 556, 250, 52, fuelSel ? '● EXTRA FUEL' : 'EXTRA FUEL +45%', { size: 14, primary: fuelSel });
    button(ctx, list, 'preflight:crate', 510, 556, 250, 52, S.preflight === 'crate' ? '● BONUS CRATE +$35' : 'BONUS CRATE +$35', { size: 14, primary: !fuelSel });
    button(ctx, list, 'fly', 790, 548, 260, 66, 'FLY ▶ TERBANG', { primary: true, size: 19 });
  } else {
    T(ctx, 'Tap a ticket to take the job.', CX, 580, '700 16px Verdana, sans-serif', PALETTE.muted, 'center');
  }
  button(ctx, list, 'hangar', 30, 640, 190, 52, 'HANGAR');
  T(ctx, nextGoal(S.save), 1250, 668, '700 12.5px Verdana, sans-serif', PALETTE.horizon, 'right');
}

/* ------------------------------- HANGAR ------------------------------- */

export function drawHangar(ctx, list, S) {
  dimScene(ctx, 0.5);
  header(ctx, 'HANGAR', `Bengkel & peta · $${S.save.cash} in the tin · Day ${S.save.day}`);
  // Campaign map: the island chain.
  panel(ctx, 70, 140, 1140, 196);
  T(ctx, 'THE ROUTE — BALI TO PAPUA', 100, 176, '900 15px Verdana, sans-serif', PALETTE.gold);
  const mapY = 252;
  const x0 = 130;
  const x1 = 1150;
  ctx.strokeStyle = 'rgba(255, 183, 3, 0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(x0, mapY); ctx.lineTo(x1, mapY); ctx.stroke();
  ctx.setLineDash([]);
  ISLANDS.forEach((island, i) => {
    const x = x0 + ((x1 - x0) * i) / (ISLANDS.length - 1);
    const unlocked = i <= S.save.islandIndex;
    const hereNow = i === S.save.atIsland;
    const stamp = S.save.stamps[island.id];
    ctx.fillStyle = unlocked ? PALETTE.grass : '#3c4a63';
    ctx.beginPath(); ctx.ellipse(x, mapY, 34, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = unlocked ? PALETTE.beach : '#5a6a86';
    ctx.beginPath(); ctx.ellipse(x, mapY - 3, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    if (stamp) drawStamp(ctx, x, mapY - 52, 24, island.name, stamp, -0.14);
    else if (!unlocked) drawLock(ctx, x, mapY - 48, 26, PALETTE.muted);
    T(ctx, island.name, x, mapY + 40, '700 11px Verdana, sans-serif', unlocked ? PALETTE.cream : PALETTE.muted, 'center');
    if (hereNow) {
      T(ctx, '▼ YOU ARE HERE', x, mapY + 60, '900 11px Verdana, sans-serif', PALETTE.gold, 'center');
    }
  });
  // Upgrade cards.
  UPGRADES.forEach((up, i) => {
    const x = 70 + i * 388;
    const y = 362;
    panel(ctx, x, y, 364, 196);
    drawUpgradeIcon(ctx, up.id, x + 46, y + 48, 52, PALETTE.gold);
    T(ctx, up.name, x + 84, y + 44, '900 18px Verdana, sans-serif', PALETTE.cream);
    T(ctx, up.nameId, x + 84, y + 66, '700 12px Verdana, sans-serif', PALETTE.horizon);
    const level = upgradeLevel(S.save, up.id);
    for (let p = 0; p < 3; p += 1) {
      ctx.fillStyle = p < level ? PALETTE.gold : 'rgba(254,246,228,0.18)';
      rr(ctx, x + 26 + p * 34, y + 92, 28, 12, 6);
      ctx.fill();
    }
    T(ctx, `LEVEL ${level}/3`, x + 140, y + 103, '700 13px Verdana, sans-serif', PALETTE.muted);
    T(ctx, up.blurb, x + 26, y + 134, '400 13.5px Verdana, sans-serif', PALETTE.muted);
    const price = upgradePrice(S.save, up.id);
    if (price === null) {
      T(ctx, 'MAXED — FULLY TUNED', x + 26, y + 172, '900 14px Verdana, sans-serif', PALETTE.teal);
    } else {
      button(ctx, list, `buy:${up.id}`, x + 26, y + 146, 190, 38, `BUY — $${price}`, { size: 14, primary: S.save.cash >= price });
    }
  });
  button(ctx, list, 'board', 880, 596, 330, 62, 'MORNING BOARD ▶', { primary: true, size: 17 });
  backButton(ctx, list);
  T(ctx, nextGoal(S.save), 240, 668, '700 12.5px Verdana, sans-serif', PALETTE.horizon);
}

/* ------------------------------- RECEIPT ------------------------------- */

export function drawReceipt(ctx, list, S) {
  dimScene(ctx, 0.42);
  const R = S.receipt;
  const ticket = R.ticket;
  const x = 340;
  const y = 84;
  const w = 600;
  const h = 552;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = PALETTE.paper;
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = PALETTE.coralDeep;
  ctx.fillRect(x, y + 26, w, 3);
  ctx.fillRect(x, y + h - 29, w, 3);
  T(ctx, 'DELIVERED', x + w / 2, y + 76, '900 40px Verdana, sans-serif', PALETTE.ink, 'center');
  T(ctx, 'TERKIRIM · POS UDARA', x + w / 2, y + 102, '900 14px Verdana, sans-serif', PALETTE.coralDeep, 'center');
  drawCargoIcon(ctx, ticket.icon, x + 58, y + 152, 44, PALETTE.ink);
  T(ctx, ticket.cargoName, x + 92, y + 146, '900 16px Verdana, sans-serif', PALETTE.ink);
  T(ctx, `${ticket.customer} · ${ISLANDS[ticket.from].name} → ${ISLANDS[ticket.to].name}`, x + 92, y + 170, '400 13.5px Verdana, sans-serif', '#5a5142');
  // Grade + bars.
  const grade = R.settle.grade;
  T(ctx, grade.grade, x + 92, y + 268, '900 84px Verdana, sans-serif', PALETTE.coralDeep);
  T(ctx, grade.label, x + 92, y + 296, '900 14px Verdana, sans-serif', PALETTE.ink);
  const bars = [
    ['SOFTNESS', R.touchdown.soft],
    ['CENTRELINE', R.touchdown.centre],
    ['APPROACH SPEED', R.touchdown.speedScore],
  ];
  bars.forEach(([label, value], i) => {
    const by = y + 208 + i * 34;
    T(ctx, label, x + 210, by + 4, '700 12px Verdana, sans-serif', '#5a5142');
    ctx.fillStyle = 'rgba(16, 28, 48, 0.14)';
    rr(ctx, x + 210, by + 10, 240, 12, 6);
    ctx.fill();
    ctx.fillStyle = value >= 72 ? PALETTE.tealDeep : value >= 45 ? PALETTE.goldDeep : PALETTE.coralDeep;
    rr(ctx, x + 210, by + 10, Math.max(10, 240 * (value / 100)), 12, 6);
    ctx.fill();
    T(ctx, String(value), x + 462, by + 21, '900 14px Verdana, sans-serif', PALETTE.ink);
  });
  // Pay lines.
  let ly = y + 338;
  for (const line of R.settle.lines) {
    T(ctx, line.label, x + 44, ly, '400 14.5px Verdana, sans-serif', PALETTE.ink);
    if (line.amount) T(ctx, `+$${line.amount}`, x + w - 44, ly, '900 14.5px Verdana, sans-serif', PALETTE.ink, 'right');
    ly += 23;
  }
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x + 44, ly - 10, w - 88, 2);
  T(ctx, 'TOTAL', x + 44, ly + 22, '900 19px Verdana, sans-serif', PALETTE.ink);
  T(ctx, `$${R.settle.total}`, x + w - 44, ly + 22, '900 22px Verdana, sans-serif', PALETTE.coralDeep, 'right');
  if (R.settle.unlocked) T(ctx, `ROUTE OPEN — ${R.settle.unlocked} is yours to fly`, x + w / 2, y + h - 100, '900 14px Verdana, sans-serif', PALETTE.tealDeep, 'center');
  else if (R.streak >= 2) T(ctx, `PERFECT STREAK ×${R.streak}`, x + w / 2, y + h - 100, '900 13px Verdana, sans-serif', PALETTE.goldDeep, 'center');
  if (R.settle.stamp) drawStamp(ctx, x + w - 108, y + 128, 56, R.settle.stamp.island, R.settle.stamp.grade, -0.18);
  button(ctx, list, 'continue', x + w / 2 - 130, y + h - 58, 260, 46, 'CONTINUE ▶', { primary: true, size: 16 });
}

export function drawDitched(ctx, list, S) {
  dimScene(ctx, 0.5);
  panel(ctx, 340, 180, 600, 330);
  T(ctx, 'DOWN IN THE SEA', CX, 258, '900 34px Verdana, sans-serif', PALETTE.bad, 'center');
  T(ctx, 'Tenggelam — the cargo is lost and the hull needs the hangar.', CX, 296, '400 16px Verdana, sans-serif', PALETTE.cream, 'center');
  T(ctx, `${S.ticket.cargoName} for ${S.ticket.customer} did not arrive.`, CX, 330, '400 15px Verdana, sans-serif', PALETTE.muted, 'center');
  T(ctx, 'The route stays open. Tomorrow the board will offer it again.', CX, 358, '400 15px Verdana, sans-serif', PALETTE.muted, 'center');
  button(ctx, list, 'continue', CX - 130, 420, 260, 50, 'BACK TO HANGAR', { primary: true });
}

/* -------------------------------- PAUSE -------------------------------- */

export function drawPause(ctx, list, S) {
  dimScene(ctx, 0.55);
  panel(ctx, 440, 150, 400, 430);
  T(ctx, 'PAUSED', CX, 216, '900 32px Verdana, sans-serif', PALETTE.cream, 'center');
  T(ctx, 'Istirahat — engines idling', CX, 244, '400 14px Verdana, sans-serif', PALETTE.muted, 'center');
  button(ctx, list, 'resume', 490, 272, 300, 54, 'RESUME ▶', { primary: true, size: 18 });
  button(ctx, list, 'controls', 490, 340, 300, 50, 'CONTROLS');
  button(ctx, list, 'settings', 490, 402, 300, 50, 'SETTINGS');
  button(ctx, list, 'quit', 490, 464, 300, 50, 'QUIT TO TITLE');
  T(ctx, `Flying with: ${schemeById(S.save.scheme).name}`, CX, 552, '700 13px Verdana, sans-serif', PALETTE.horizon, 'center');
}
