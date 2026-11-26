// config.js — every tunable number, name and mission definition for KESTREL-7.
// All constants carry their unit in the name or the comment beside them, so the
// dossier outline and the README describe the same game the code runs.
// Original names only: no commercial game, aircraft or unit names appear anywhere.

export const GAME_TITLE = 'KESTREL-7';
export const GAME_SUBTITLE = 'Canyon Run';
export const SQUADRON = 'VERMILION WING';
export const AIRCRAFT_NAME = 'KESTREL-7';
export const AIRCRAFT_REG = 'KV-7';

// Wingmen shown on the left HUD cards (callsign, name, role).
export const WINGMEN = [
  { callsign: 'HALO', name: 'R. IVES', role: 'LEAD', color: '#7fe7ff' },
  { callsign: 'BRICK', name: 'D. OKONKWO', role: 'HEAVY', color: '#ffd166' },
  { callsign: 'SABLE', name: 'M. ARAYA', role: 'NIGHT', color: '#ff9d7e' },
];

// Flight tuning. Speeds in knots (KT), altitudes in feet (FT), angles in degrees.
export const FLIGHT = {
  minSpeedKt: 90, // stall speed: below this the jet sinks and cannot climb
  maxSpeedKt: 620, // full military throttle, level flight
  cruiseSpeedKt: 280,
  accelKtPerSec: 55, // throttle 100% adds this much speed per second
  dragKtPerSec: 26, // air drag at cruise, grows with speed squared
  climbFtPerSecAtFull: 5200, // vertical speed at full throttle, nose up
  sinkFtPerSecAtIdle: 1800, // vertical speed at idle throttle, nose level
  pitchRateDegPerSec: 42, // nose up/down authority
  rollRateDegPerSec: 150, // bank authority
  turnRateDegPerSecAtBank60: 24, // heading change per second at 60 deg bank
  fuelBurnPerSecAtFull: 0.55, // % of tank per second at full throttle
  fuelBurnPerSecAtIdle: 0.12, // % of tank per second at idle throttle
  maxFuelPercent: 100,
  maxHullPercent: 100,
  terrainHitDamage: 34, // hull % lost on a canyon-wall strike
  hardLandingDamage: 22, // hull % lost on a touchdown faster than the limit
  safeTouchdownFpm: 900, // vertical speed limit for a clean landing (feet/min)
  safeTouchdownKt: 170, // airspeed limit for a clean landing
};

// World size in metres. 1 unit = 1 metre in the scene; HUD shows feet/knots.
export const WORLD = {
  size: 4200, // terrain plane is size x size metres, centred on origin
  segments: 160, // terrain mesh resolution per side
  canyonHalfWidth: 260, // flat valley floor half-width in metres
  wallHeight: 320, // canyon wall height above the valley floor (metres)
  runwayLength: 900, // runway strip length (metres), along Z
  runwayWidth: 46,
  runwayCenterZ: 1500, // runway sits at the far south end of the canyon
  ceilingFt: 12000, // HUD altitude ceiling shown on the tape
  bounds: 2900, // soft turn-back boundary in metres from origin: wide enough
  // that the runway 09 final approach (x ~ 400, z ~ 2600, dist ~ 2630)
  // never triggers it
};

// Mission definitions. Three sorties, three different goals.
export const MISSIONS = [
  {
    id: 'ring-run',
    index: 0,
    name: 'SORTIE 1 — RING RUN',
    short: 'RING RUN',
    place: 'Ember Canyon · 8 rings down the valley',
    brief: 'Throttle up, chase the gold rings in order. Full throttle burns fuel fast — ease off on the straights.',
    ringCount: 8,
    ringRadius: 26, // metres, pass-through radius of each ring
    rewardPerRing: 250,
    timeLimitSec: 240,
  },
  {
    id: 'canyon-delivery',
    index: 1,
    name: 'SORTIE 2 — CANYON DELIVERY',
    short: 'DELIVERY',
    place: 'Ember Canyon · ridge crossing at 3.6 NM',
    brief: 'Carry the survey pod through the canyon to the drop pad. A ridge crosses the valley — climb over it, or thread the gap.',
    ringCount: 6,
    ringRadius: 30,
    rewardPerRing: 300,
    timeLimitSec: 300,
  },
  {
    id: 'night-landing',
    index: 2,
    name: 'SORTIE 3 — NIGHT LANDING',
    short: 'NIGHT LANDING',
    place: 'Ember Field · land on runway 09',
    brief: 'Follow the glidepath lights down to the strip. Touch down gentle: under 170 KT and under 900 FPM, or the gear takes it.',
    ringCount: 4,
    ringRadius: 34,
    rewardPerRing: 200,
    timeLimitSec: 360,
    night: true,
  },
];

export const SCORE = {
  ringBonus: 250,
  perfectLandingBonus: 1500,
  roughLandingBonus: 600,
  crashPenalty: 0,
  fuelBonusPerPercent: 10, // leftover fuel converts to score at mission end
};

// Seeded random (mulberry32) so terrain, clouds and ring jitter are identical
// on every load — screenshots are reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
