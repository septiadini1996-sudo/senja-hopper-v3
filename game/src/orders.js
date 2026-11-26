// The morning board: named customers with story cargo. Tickets are generated
// per day from a catalogue; two scripted story beats make Ibu Ratna return —
// her first medicine run opens the game, her second comes back on day 5 in
// worse weather, exactly as the poster on the hangar wall promises.

import { ISLANDS } from './config.js';
import { makeRng } from './rng.js';

export const CARGO = {
  medicine: { name: 'CLINIC MEDICINE VIALS', nameId: 'OBAT KLINIK', icon: 'vial', fragile: true },
  dress: { name: 'A WEDDING DRESS', nameId: 'GAUN PENGANTIN', icon: 'dress', fragile: true },
  exams: { name: 'EXAM PAPERS, SEALED', nameId: 'NASKAH UJIAN', icon: 'papers', fragile: false },
  turtle: { name: 'A SICK SEA TURTLE', nameId: 'PENYU SAKIT', icon: 'turtle', fragile: true },
  baby: { name: 'BABY SUPPLIES', nameId: 'PERLENGKAPAN BAYI', icon: 'bottle', fragile: false },
  spices: { name: 'NUTMEG & CLOVES', nameId: 'PALA & CENGKEH', icon: 'spices', fragile: false },
  fish: { name: 'ICE & SMOKED FISH', nameId: 'IKAN ASAP & ES', icon: 'fish', fragile: false },
  flowers: { name: 'ORCHIDS FOR A FUNERAL', nameId: 'ANGGREK DUKA', icon: 'flowers', fragile: true },
  mail: { name: 'MAIL SACK No. 7', nameId: 'KANTONG POS No. 7', icon: 'mail', fragile: false },
  engine: { name: 'A BOAT ENGINE PART', nameId: 'SUKU CADANG MESIN', icon: 'engine', fragile: false },
};

const CUSTOMERS = [
  { name: 'Ibu Ratna', role: 'clinic nurse', cargo: 'medicine' },
  { name: 'Pak Wayan', role: 'school head', cargo: 'exams' },
  { name: 'Sari Dewi', role: 'bride-to-be', cargo: 'dress' },
  { name: 'Dr. Bimo', role: 'turtle rescue vet', cargo: 'turtle' },
  { name: 'Mama Yosefa', role: 'midwife', cargo: 'baby' },
  { name: 'Pak Haji Umar', role: 'spice trader', cargo: 'spices' },
  { name: 'Nelajan Rudi', role: 'smokehouse keeper', cargo: 'fish' },
  { name: 'Ibu Florens', role: 'florist', cargo: 'flowers' },
  { name: 'Pak Pos Gede', role: 'postmaster', cargo: 'mail' },
  { name: 'Bengkel Toni', role: 'boat mechanic', cargo: 'engine' },
];

/**
 * A ticket: fly `cargo` for `customer` from the island the plane is parked at
 * to island `to`. Pay scales with distance and fragility; the clock is the
 * late-decay deadline in seconds of flight time.
 */
export function makeTicket(day, from, to, customerIndex, seed, story) {
  const rng = makeRng(seed);
  const customer = CUSTOMERS[customerIndex % CUSTOMERS.length];
  const cargo = CARGO[customer.cargo];
  const dist = ISLANDS[to].dist;
  const base = Math.round((46 + dist * 0.055) * (cargo.fragile ? 1.3 : 1) * rng.range(0.92, 1.12));
  return {
    day,
    from,
    to,
    customer: customer.name,
    role: customer.role,
    cargoId: customer.cargo,
    cargoName: cargo.name,
    cargoNameId: cargo.nameId,
    icon: cargo.icon,
    fragile: cargo.fragile,
    basePay: base,
    clock: Math.round(dist / 26) + 55,
    weather: story ? story.weather : 1 + Math.floor((to + day) / 3),
    story: story ? story.id : null,
    seed,
  };
}

/** The scripted story beats, keyed by day. Day 1 and day 5 belong to Ibu Ratna. */
export const STORY_BEATS = {
  1: { id: 'ratna-1', weather: 1, note: 'Her clinic is out of fever medicine. The whole island is waiting on this box.' },
  5: { id: 'ratna-2', weather: 3, note: 'Ibu Ratna again — the fever is back and so is the rain. She asked for you by name.' },
};

/** Three tickets for the morning board at the parked island. */
export function morningBoard(save) {
  const from = save.atIsland;
  const day = save.day;
  const tickets = [];
  const beat = STORY_BEATS[day];
  const rng = makeRng(day * 7919 + from * 131);
  const reachable = [];
  for (let i = 0; i < ISLANDS.length; i += 1) {
    if (i !== from && i <= save.islandIndex + 1) reachable.push(i);
  }
  if (beat && from === 0) {
    tickets.push(makeTicket(day, from, Math.min(2, save.islandIndex + 1), 0, day * 104729 + 7, { id: beat.id, weather: beat.weather }));
  }
  // Fill the board to three jobs: distinct customers every time; destinations
  // may repeat early on, when only one island is open — two jobs to the same
  // strip is just a busy morning.
  let guard = 0;
  while (tickets.length < 3 && guard < 60) {
    guard += 1;
    const to = reachable[rng.int(0, reachable.length - 1)];
    const customerIndex = rng.int(0, CUSTOMERS.length - 1);
    if (tickets.some((t) => t.customer === CUSTOMERS[customerIndex].name)) continue;
    if (tickets.some((t) => t.to === to && t.cargoId === CUSTOMERS[customerIndex].cargo)) continue;
    tickets.push(makeTicket(day, from, to, customerIndex, day * 104729 + tickets.length * 977 + guard, null));
  }
  return tickets;
}

export function storyNote(ticket) {
  if (!ticket.story) return null;
  const beat = Object.values(STORY_BEATS).find((b) => b.id === ticket.story);
  return beat ? beat.note : null;
}
