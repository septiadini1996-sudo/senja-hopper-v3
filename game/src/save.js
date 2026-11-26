// Guarded localStorage persistence. Every access is wrapped so a browser that
// refuses storage (private mode, file policy) simply plays session-only.

const KEY = 'senja-hopper-save-v3';

export function defaultSave() {
  return {
    version: 3,
    started: false,
    day: 1,
    islandIndex: 0, // furthest unlocked island
    atIsland: 0, // where the plane is parked
    cash: 120,
    stamps: {}, // islandId -> grade earned
    upgrades: { engine: 0, tank: 0, hull: 0 },
    scheme: 'keyboard',
    season: 1, // index into SEASONS (Trade Winds)
    sound: true,
    gyroSensitivity: 1,
    stats: { flights: 0, delivered: 0, ditched: 0, rings: 0, ringTries: 0, perfect: 0, earned: 0, bestStreak: 0 },
    challenges: {}, // id -> progress
    storySeen: {},
  };
}

export function loadSave(storage) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const base = defaultSave();
    const merged = { ...base, ...parsed, stats: { ...base.stats, ...(parsed.stats || {}) }, upgrades: { ...base.upgrades, ...(parsed.upgrades || {}) }, stamps: parsed.stamps || {}, challenges: parsed.challenges || {}, storySeen: parsed.storySeen || {} };
    return merged.version === 3 ? merged : base;
  } catch (err) {
    return defaultSave();
  }
}

export function storeSave(storage, save) {
  try {
    storage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch (err) {
    return false;
  }
}

export function wipeSave(storage) {
  try {
    storage.removeItem(KEY);
  } catch (err) {
    /* storage unavailable: nothing to wipe */
  }
}

/** The browser storage when present, else an in-memory stand-in (used by tests too). */
export function browserStorage() {
  try {
    const s = window.localStorage;
    const probe = '__senja_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch (err) {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
  }
}
