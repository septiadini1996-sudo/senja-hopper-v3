// Campaign progression: cash, stamps, island unlocks, hangar upgrades,
// challenges and career stats — and the settlement that turns a landed flight
// into all of them. Pure logic over the save object; the screens render it.

import { GRADES, ISLANDS } from './config.js';

export const UPGRADES = [
  { id: 'engine', name: 'ENGINE', nameId: 'MESIN', blurb: '+6 m/s top speed & pull per level', prices: [90, 170, 290] },
  { id: 'tank', name: 'FUEL TANK', nameId: 'TANGKI', blurb: '+35% fuel per level', prices: [70, 140, 240] },
  { id: 'hull', name: 'HULL', nameId: 'LAMBUNG', blurb: '+25 hull & slower damage per level', prices: [80, 150, 260] },
];

export const CHALLENGES = [
  { id: 'rings10', name: 'RING RUNNER', desc: 'Thread 10 golden rings', target: 10, icon: 'ring' },
  { id: 'stamps4', name: 'ISLAND HOPPER', desc: 'Collect 4 island stamps', target: 4, icon: 'stamp' },
  { id: 'perfect3', name: 'SILK LANDINGS', desc: 'Land 3 S-grade deliveries', target: 3, icon: 'star' },
  { id: 'streak3', name: 'HOT STREAK', desc: 'Reach a perfect-landing streak of 3', target: 3, icon: 'flame' },
  { id: 'earn1000', name: 'POS UDARA PRO', desc: 'Earn 1,000 cash in total', target: 1000, icon: 'coin' },
  { id: 'papua', name: 'TO THE SUNRISE', desc: 'Deliver to Papua, the last island', target: 1, icon: 'sun' },
];

export function gradeFor(score) {
  for (const g of GRADES) if (score >= g.min) return g;
  return GRADES[GRADES.length - 1];
}

export function upgradeLevel(save, id) {
  return save.upgrades[id] || 0;
}

export function upgradePrice(save, id) {
  const def = UPGRADES.find((u) => u.id === id);
  const level = upgradeLevel(save, id);
  return level >= def.prices.length ? null : def.prices[level];
}

export function buyUpgrade(save, id) {
  const price = upgradePrice(save, id);
  if (price === null || save.cash < price) return false;
  save.cash -= price;
  save.upgrades[id] += 1;
  return true;
}

export function maxHull(save) {
  return 100 + upgradeLevel(save, 'hull') * 25;
}

export function fuelCapacity(save) {
  return 100 * (1 + upgradeLevel(save, 'tank') * 0.35);
}

export function stampCount(save) {
  return Object.keys(save.stamps).length;
}

export function challengeProgress(save, id) {
  return Math.min(save.challenges[id] || 0, CHALLENGES.find((c) => c.id === id).target);
}

function bump(save, id, value) {
  save.challenges[id] = Math.max(save.challenges[id] || 0, value);
}

/**
 * Settle a finished flight into the campaign. `result` carries the flight's
 * outcome: { ticket, landed, gradeScore, ringScore, ringCentres, ringThreads,
 * streak, late }. Returns the receipt lines the DELIVERED screen prints.
 */
export function settleFlight(save, result) {
  const lines = [];
  save.stats.flights += 1;
  if (!result.landed) {
    save.stats.ditched += 1;
    lines.push({ label: 'CARGO LOST AT SEA', amount: 0 });
    return { lines, total: 0, stamp: null, unlocked: null, grade: null };
  }
  const grade = gradeFor(result.gradeScore);
  const ticket = result.ticket;
  const timeFactor = result.late ? 0.55 : 1;
  const base = Math.round(ticket.basePay * timeFactor);
  const gradeBonus = Math.round(base * (grade.mult - 1));
  const total = base + gradeBonus + result.ringScore;
  save.cash += total;
  save.stats.delivered += 1;
  save.stats.earned += total;
  save.stats.rings += result.ringCentres + result.ringThreads;
  if (grade.grade === 'S') save.stats.perfect += 1;
  save.stats.bestStreak = Math.max(save.stats.bestStreak, result.streak);
  lines.push({ label: `DELIVERY — ${ticket.cargoName}`, amount: base });
  if (gradeBonus !== 0) lines.push({ label: `GRADE ${grade.grade} BONUS`, amount: gradeBonus });
  if (result.ringScore > 0) lines.push({ label: 'GOLDEN RINGS', amount: result.ringScore });
  if (result.late) lines.push({ label: 'LATE — the clock ran out', amount: 0 });
  let stamp = null;
  const destId = ISLANDS[ticket.to].id;
  if (!save.stamps[destId] || gradeFor(result.gradeScore).min > gradeFor(pseudoScore(save.stamps[destId])).min) {
    save.stamps[destId] = grade.grade;
    stamp = { island: ISLANDS[ticket.to].name, grade: grade.grade };
  }
  let unlocked = null;
  if (ticket.to > save.islandIndex && ticket.to === save.islandIndex + 1) {
    save.islandIndex = ticket.to;
    unlocked = ISLANDS[ticket.to].name;
  }
  save.atIsland = ticket.to;
  save.day += 1;
  bump(save, 'rings10', save.stats.rings);
  bump(save, 'stamps4', stampCount(save));
  bump(save, 'perfect3', save.stats.perfect);
  bump(save, 'streak3', save.stats.bestStreak);
  bump(save, 'earn1000', save.stats.earned);
  if (destId === 'papua') bump(save, 'papua', 1);
  return { lines, total, stamp, unlocked, grade };
}

function pseudoScore(gradeLetter) {
  const g = GRADES.find((x) => x.grade === gradeLetter);
  return g ? g.min : 0;
}

/** The one-line goal that rides on the HUD and the hangar wall. */
export function nextGoal(save) {
  if (!save.started) return 'NEXT: Take Ibu Ratna\u2019s medicine to Nusa Penida';
  const next = ISLANDS[save.islandIndex + 1];
  if (save.stats.perfect < 3) return `NEXT: Land an S-grade delivery (${save.stats.perfect}/3 silk landings)`;
  if (next) return `NEXT: Earn the ${next.name} stamp — unlock the route east`;
  return 'NEXT: You hold every stamp from Bali to Papua. Legend of Pos Udara.';
}
