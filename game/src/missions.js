// missions.js — the three sorties and their rules.
// One job: place rings / the drop pad / the runway approach, score passes,
// and decide when a sortie is complete, failed, or crashed.
// Ring positions are seeded so every load of the same mission is identical.

import { MISSIONS, WORLD, SCORE, mulberry32 } from './config.js';
import { canyonCenterX, runwayCenterX, heightAt } from './terrain.js';
import { isOverRunway } from './flight.js';

export function createMissionState(missionIndex) {
  const def = MISSIONS[missionIndex] || MISSIONS[0];
  const rand = mulberry32(1000 + missionIndex * 77);
  const rings = [];
  if (def.id === 'ring-run') {
    // Eight rings down the valley, north to south, weaving side to side.
    for (let i = 0; i < def.ringCount; i++) {
      const z = 1500 - i * 380;
      const x = canyonCenterX(z) + (rand() - 0.5) * 220;
      rings.push({ x, y: 90 + rand() * 130, z, radius: def.ringRadius, passed: false });
    }
  } else if (def.id === 'canyon-delivery') {
    // Six rings to the drop pad, with a ridge gap at ring 4 (z ~ 360).
    for (let i = 0; i < def.ringCount; i++) {
      const z = 1500 - i * 300;
      let x = canyonCenterX(z) + (rand() - 0.5) * 160;
      let y = 110 + rand() * 90;
      if (i === 3) { // the gap: low, centred, through the ridge notch
        x = canyonCenterX(z);
        y = 70;
      }
      rings.push({ x, y, z, radius: def.ringRadius, passed: false });
    }
  } else {
    // Night landing: four approach rings on the glidepath to runway 09,
    // centred on the valley so the approach follows the canyon down.
    // The jet spawns south of the strip (z 2600) and flies north: each ring
    // is closer to the threshold AND lower than the last — a real descent,
    // not a climb away from the runway.
    for (let i = 0; i < def.ringCount; i++) {
      const z = 2450 - i * 200;
      rings.push({
        x: canyonCenterX(z), y: 200 - i * 50, z, radius: def.ringRadius, passed: false,
      });
    }
  }
  // Spawn: ring-run and delivery start over the canyon mouth (z 1750);
  // the night landing starts south of the strip (z 2600) so the whole
  // glidepath is flown, not teleported past.
  const spawn = def.id === 'night-landing'
    ? { x: canyonCenterX(2600), y: 250, z: 2600, headingDeg: 0 }
    : { x: canyonCenterX(1750), y: 150, z: 1750, headingDeg: 0 };
  return {
    def,
    rings,
    spawn,
    nextRing: 0,
    score: 0,
    ringsPassed: 0,
    timeLeftSec: def.timeLimitSec,
    elapsedSec: 0,
    status: 'flying', // flying | complete | crashed | out-of-fuel | timed-out | landed-short
    message: def.brief,
    messageAt: 0,
    landing: null, // { gentle: true|false } once touched down
    delivered: false, // delivery mission: drop pad reached
    flameoutAnnounced: false, // fuel-empty warning shown once; the glide goes on
  };
}

// The drop pad for the delivery sortie: a lit pad at the south end of the valley.
export function dropPadPosition() {
  return { x: canyonCenterX(-300), y: heightAt(canyonCenterX(-300), -300), z: -300 };
}

// Advance mission logic one frame. Returns nothing; mutates mission + flight.
export function stepMission(mission, flight, dt) {
  if (mission.status !== 'flying') return;
  mission.elapsedSec += dt;
  mission.timeLeftSec = Math.max(0, mission.def.timeLimitSec - mission.elapsedSec);
  if (mission.timeLeftSec <= 0) {
    mission.status = 'timed-out';
    mission.message = 'TIME UP — the sortie window closed. Press R to fly it again.';
    return;
  }
  if (flight.fuelPercent <= 0 && !flight.landed && !flight.crashed) {
    // Flameout is a warning, not an ending: the jet glides on, and the
    // sortie is decided by what the glide achieves — a landing, a crash,
    // or the clock. Ending the mission here made "glide it down" impossible.
    if (!mission.flameoutAnnounced) {
      mission.flameoutAnnounced = true;
      mission.message = 'FLAMEOUT — TANK DRY. Glide her down — gear down, find the strip.';
    }
  }
  if (flight.crashed) {
    mission.status = 'crashed';
    mission.message = 'KESTREL-7 IS DOWN — hull lost. Press R to fly again.';
    return;
  }

  // Ring passes: within the ring's radius of its centre counts.
  const ring = mission.rings[mission.nextRing];
  if (ring && !ring.passed) {
    const dx = flight.x - ring.x;
    const dy = flight.y - ring.y;
    const dz = flight.z - ring.z;
    if (Math.hypot(dx, dy, dz) < ring.radius) {
      ring.passed = true;
      mission.ringsPassed += 1;
      mission.score += mission.def.rewardPerRing;
      mission.nextRing += 1;
      mission.message = mission.nextRing >= mission.rings.length
        ? 'ALL RINGS CLEAR — finish the run at the strip, or press R for the next sortie.'
        : `RING ${mission.ringsPassed}/${mission.rings.length} CLEAR  +${mission.def.rewardPerRing}`;
      mission.messageAt = mission.elapsedSec;
    }
  }

  // Delivery: after the last ring, crossing the pad low and slow drops the pod.
  if (mission.def.id === 'canyon-delivery' && !mission.delivered
    && mission.nextRing >= mission.rings.length) {
    const pad = dropPadPosition();
    const d = Math.hypot(flight.x - pad.x, flight.z - pad.z);
    if (d < 60 && flight.y - pad.y < 45) {
      mission.delivered = true;
      mission.score += 1200;
      mission.score += Math.round(flight.fuelPercent * SCORE.fuelBonusPerPercent);
      mission.message = 'POD DELIVERED +1200 — survey pod on the pad. Sortie complete!';
      mission.status = 'complete';
    }
  }

  // Landing: a touchdown on runway 09 ends the sortie — but only counts as
  // complete when the sortie's own goals are done. Landing short of the
  // rings (or without the pod) ends the sortie as landed-short, not a win.
  if (flight.landed) {
    const gentle = mission.landing && mission.landing.gentle;
    const goalsDone = mission.def.id === 'night-landing'
      ? true // the landing IS the goal; the rings are guidance
      : mission.def.id === 'ring-run'
        ? mission.nextRing >= mission.rings.length
        : mission.delivered;
    if (goalsDone) {
      mission.score += gentle ? SCORE.perfectLandingBonus : SCORE.roughLandingBonus;
      mission.score += Math.round(flight.fuelPercent * SCORE.fuelBonusPerPercent);
      mission.message = gentle
        ? `TOUCHDOWN — CLEAN LANDING +${SCORE.perfectLandingBonus} · fuel bonus banked. Sortie complete!`
        : `TOUCHDOWN — ROUGH LANDING +${SCORE.roughLandingBonus} · the gear took a hit. Sortie complete.`;
      mission.status = 'complete';
    } else {
      mission.message = 'LANDED SHORT — the sortie goals were not finished. Press R to fly it again.';
      mission.status = 'landed-short';
    }
  }

  // Ring run: clearing the last ring completes the sortie in the air.
  if (mission.def.id === 'ring-run' && mission.nextRing >= mission.rings.length
    && mission.status === 'flying') {
    mission.score += Math.round(flight.fuelPercent * SCORE.fuelBonusPerPercent);
    mission.message = `RING RUN COMPLETE — all 8 rings, fuel bonus banked. Press 2 for the next sortie.`;
    mission.status = 'complete';
  }

  // Night landing: rings are the glidepath; the landing itself completes it.
  if (mission.def.id === 'night-landing' && mission.nextRing >= mission.rings.length
    && mission.status === 'flying') {
    mission.message = 'GLIDEPATH CLEAR — runway 09 ahead, gear down, bring her in gentle.';
  }
}

// Distance (metres) and bearing to the next objective, for the HUD.
export function nextObjective(mission, flight) {
  const ring = mission.rings[mission.nextRing];
  if (ring) {
    const dx = ring.x - flight.x;
    const dz = ring.z - flight.z;
    const distM = Math.hypot(dx, dz);
    const bearing = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    return { kind: 'ring', distM, bearing, x: ring.x, y: ring.y, z: ring.z };
  }
  if (mission.def.id === 'canyon-delivery' && !mission.delivered) {
    const pad = dropPadPosition();
    const dx = pad.x - flight.x;
    const dz = pad.z - flight.z;
    return { kind: 'pad', distM: Math.hypot(dx, dz), bearing: (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360, ...pad };
  }
  return {
    kind: 'runway',
    distM: Math.hypot(flight.x - runwayCenterX(), flight.z - WORLD.runwayCenterZ),
    bearing: (Math.atan2(runwayCenterX() - flight.x, flight.z - WORLD.runwayCenterZ) * 180 / Math.PI + 360) % 360,
    x: runwayCenterX(), y: 10, z: WORLD.runwayCenterZ,
  };
}

export { isOverRunway };
