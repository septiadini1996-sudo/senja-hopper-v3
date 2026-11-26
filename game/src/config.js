// Senja Hopper — shared constants: canvas, the golden-hour palette and flight tuning.
// Every colour in the game comes from PALETTE so menus, tickets, maps and the flight
// view all read as one illustrated world.

export const VIEW = { width: 1280, height: 720 };

/** Fixed simulation step (seconds) so flights, tests and staged shots agree. */
export const STEP = 1 / 60;

export const PALETTE = {
  skyTop: '#27436e',
  skyMid: '#7d6a9e',
  skyLow: '#e8906f',
  horizon: '#ffd9a0',
  sunCore: '#fff3b0',
  sunGlow: '#ffb703',
  seaFar: '#3d8fa3',
  seaNear: '#0d4356',
  glitter: '#ffcf6e',
  beach: '#eec97e',
  grass: '#5da24f',
  grassDark: '#2f6b3a',
  hillFar: '#5b5f97',
  hillMid: '#46688f',
  cloudWarm: '#ffd9b8',
  cloudShade: '#c98a7d',
  cloudFar: '#8d7fb8',
  storm: '#3a3f5c',
  stormLight: '#6c7299',
  rain: '#a8dadc',
  ink: '#101c30',
  panel: 'rgba(13, 24, 43, 0.88)',
  panelSoft: 'rgba(13, 24, 43, 0.72)',
  panelEdge: '#ffb703',
  cream: '#fef6e4',
  paper: '#fdf3d8',
  muted: '#b9c6ce',
  gold: '#ffd60a',
  goldDeep: '#f59e0b',
  coral: '#ee6c4d',
  coralDeep: '#d1495b',
  teal: '#22b8a6',
  tealDeep: '#118ab2',
  good: '#7bd747',
  bad: '#ef6461',
  planeBody: '#fdf6e3',
  planeShade: '#d9c9a3',
  planeAccent: '#ee6c4d',
  planeTeal: '#118ab2',
};

/** Flight-model tuning in game units (metres, seconds). */
export const PLANE = {
  maxSpeed: 68, // m/s at full throttle, engine level 0
  minSpeed: 0,
  accel: 14,
  dragQuad: 0.0016,
  stallSpeed: 21,
  rotateSpeed: 24,
  climbRate: 9.5, // m/s at full pitch-up, healthy speed
  sinkRate: 11,
  bankRate: 26, // lateral m/s at full bank
  turnSink: 2.2, // extra sink while banked hard
  liftCeiling: 260,
  waterDrag: 26,
};

export const LEG = {
  ringCount: 5,
  ringRadius: 13, // metres: centre distance that still counts as threading
  nearMiss: 22,
  stormDamage: 7, // hull per second inside a cell
  birdDamage: 9,
  birdNearBonus: 25,
  ringCentre: 250,
  ringThread: 100,
  ringNear: 40,
};

/** The eight campaign islands, west to east. dist = typical leg length in metres. */
export const ISLANDS = [
  { id: 'bali', name: 'BALI', field: 'Ngurah Rai Seaplane Base', dist: 1500, lat: 0 },
  { id: 'penida', name: 'NUSA PENIDA', field: 'Toya Pakeh Strip', dist: 1350, lat: 90 },
  { id: 'lombok', name: 'LOMBOK', field: 'Senggigi Water Strip', dist: 1750, lat: -120 },
  { id: 'sumbawa', name: 'SUMBAWA', field: 'Poto Tano Strip', dist: 2100, lat: 140 },
  { id: 'flores', name: 'FLORES', field: 'Labuan Bajo Strip', dist: 2400, lat: -160 },
  { id: 'sumba', name: 'SUMBA', field: 'Tambolaka Strip', dist: 2600, lat: 180 },
  { id: 'timor', name: 'TIMOR', field: 'Kupang Bay Strip', dist: 2900, lat: -140 },
  { id: 'papua', name: 'PAPUA', field: 'Sentani Lake Strip', dist: 3300, lat: 120 },
];

/** Difficulty seasons: pay multiplier and grading leniency. */
export const SEASONS = [
  { id: 'calm', name: 'MUSIM TENANG', en: 'Calm Season', pay: 1, gust: 0.6, leniency: 1.15 },
  { id: 'trade', name: 'MUSIM ANGIN', en: 'Trade Winds', pay: 1.25, gust: 1, leniency: 1 },
  { id: 'monsoon', name: 'MUSIM HUJAN', en: 'Monsoon', pay: 1.6, gust: 1.55, leniency: 0.9 },
];

export const GRADES = [
  { grade: 'S', min: 86, label: 'SEMPURNA', mult: 1.5 },
  { grade: 'A', min: 72, label: 'MULUS', mult: 1.25 },
  { grade: 'B', min: 55, label: 'AMAN', mult: 1 },
  { grade: 'C', min: 38, label: 'GOYAH', mult: 0.8 },
  { grade: 'D', min: 0, label: 'SELAMAT SAJA', mult: 0.6 },
];
