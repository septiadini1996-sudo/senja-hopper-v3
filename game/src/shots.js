// Staged screenshots, the starter's way: every scene is the real game played
// forward from a seeded state by the autopilot, or a campaign state built by
// calling the real settlement code — never a posed or painted frame.
//   ?shot=cover     mid-flight, a breath before the third ring, two banked
//   ?shot=delivered the DELIVERED receipt of a really-flown day-1 delivery
//   ?shot=campaign  hangar map after three settled deliveries
//   ?shot=controls  the CONTROLS screen with GYRO active

import { STEP } from './config.js';
import { makeTicket, morningBoard } from './orders.js';
import { settleFlight } from './campaign.js';
import { projX, projY } from './render.js';

function flyUntil(host, predicate, maxSteps) {
  let steps = 0;
  while (!predicate(host) && steps < maxSteps) {
    host.step(STEP, true);
    steps += 1;
  }
  return steps;
}

function stageCover(host) {
  const save = host.freshSave();
  host.setSave(save);
  const board = morningBoard(save);
  const ticket = board[0];
  host.flyTicket(ticket, 'fuel');
  // Fly until two rings are banked and the NEXT unscored ring hangs centred
  // ahead of the nose, 60–170 m out, in calm air — the poster moment.
  flyUntil(host, (h) => {
    const f = h.flight;
    const leg = h.leg;
    const banked = leg.rings.filter((r) => r.scored === 1 || r.scored === 2).length;
    const next = leg.rings.find((r) => r.scored === 0);
    if (!next || banked < 2) return f.phase !== 'air' && f.phase !== 'roll';
    const rel = next.dist - f.dist;
    const rx = projX(next.lat - f.lat, rel);
    const ry = projY(f.alt, next.alt, rel, f.pitchVis);
    const framed = rel >= 55 && rel <= 135 && Math.abs(rx - 640) <= 280 && ry >= 120 && ry <= 440 && Math.abs(f.bankVis) < 0.5;
    return framed || (f.phase !== 'air' && f.phase !== 'roll');
  }, 60 * 240);
  host.clearPopups();
  host.setScreen('flight');
}

function stageDelivered(host) {
  const save = host.freshSave();
  host.setSave(save);
  const board = morningBoard(save);
  const ticket = board[0];
  host.flyTicket(ticket, 'fuel');
  flyUntil(host, (h) => h.flight.phase === 'landed' || h.flight.phase === 'ditched', 60 * 600);
  if (host.flight.phase === 'landed') {
    host.settleCurrent();
    host.setScreen('receipt');
  } else {
    host.setScreen('flight');
  }
}

function stageCampaign(host) {
  const save = host.freshSave();
  host.setSave(save);
  const legs = [
    { to: 1, cust: 0, gradeScore: 93, ringScore: 350 },
    { to: 2, cust: 2, gradeScore: 79, ringScore: 200 },
    { to: 3, cust: 4, gradeScore: 64, ringScore: 100 },
  ];
  for (const legDef of legs) {
    const ticket = makeTicket(save.day, save.atIsland, legDef.to, legDef.cust, save.day * 331 + legDef.to, null);
    settleFlight(save, {
      ticket,
      landed: true,
      gradeScore: legDef.gradeScore,
      ringScore: legDef.ringScore,
      ringCentres: 2,
      ringThreads: 1,
      streak: 1,
      late: false,
    });
  }
  save.started = true;
  host.setScreen('hangar');
}

function stageControls(host) {
  const save = host.freshSave();
  save.scheme = 'gyro';
  save.started = true;
  host.setSave(save);
  host.setGyroForced(true);
  host.setScreen('controls');
}

export function stageShot(name, host) {
  if (name === 'delivered') stageDelivered(host);
  else if (name === 'campaign') stageCampaign(host);
  else if (name === 'controls') stageControls(host);
  else stageCover(host);
}
