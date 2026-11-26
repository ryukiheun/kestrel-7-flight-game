// flight.js — arcade flight physics for one jet.
// One job: advance position, heading, speed, altitude, fuel and hull from the
// pilot's controls and the terrain height. No rendering, no DOM, no missions.

import { FLIGHT, WORLD } from './config.js';
import { canyonCenterX, runwayCenterX } from './terrain.js';

const DEG = Math.PI / 180;

export function createFlightState() {
  return {
    // Position in metres (x east, y up, z south). Start over the canyon mouth,
    // already airborne at cruise, heading north down the valley (-Z). The
    // start x is the valley centre at the start z, so the jet never spawns
    // over a slope.
    x: canyonCenterX(1750),
    y: 150, // metres above sea level; valley floor is ~0
    z: 1750,
    headingDeg: 0, // 0 = north (-Z), 90 = east (+X)
    pitchDeg: 0, // nose up positive
    bankDeg: 0, // right wing down positive
    speedKt: FLIGHT.cruiseSpeedKt,
    throttle: 0.62, // 0..1
    fuelPercent: FLIGHT.maxFuelPercent,
    hullPercent: FLIGHT.maxHullPercent,
    verticalSpeedFpm: 0,
    crashed: false,
    landed: false,
    onGround: false,
    distanceFlownM: 0,
  };
}

// Advance the jet one frame. dt is seconds. heightAt(x, z) returns terrain
// height in metres; onTerrainHit / onTouchdown are callbacks for the caller.
export function stepFlight(state, input, dt, heightAt, events) {
  if (state.crashed || state.landed) return state;

  // --- Throttle: Shift spools up, Ctrl spools down, W/S pitch the nose. ---
  if (input.throttleUp) state.throttle = Math.min(1, state.throttle + dt * 0.55);
  if (input.throttleDown) state.throttle = Math.max(0, state.throttle - dt * 0.55);

  // --- Speed: throttle pushes, drag pulls, climbing costs speed. ---
  const climbCost = Math.sin(state.pitchDeg * DEG) * 22;
  const drag = FLIGHT.dragKtPerSec * Math.pow(state.speedKt / FLIGHT.maxSpeedKt, 2);
  const accel = state.throttle * FLIGHT.accelKtPerSec - drag - climbCost;
  state.speedKt = Math.min(FLIGHT.maxSpeedKt, Math.max(0, state.speedKt + accel * dt));

  // --- Attitude: pitch and bank follow the stick, bank turns the heading. ---
  const targetPitch = input.pitch * 18; // stick maps to +/-18 deg nose
  state.pitchDeg += (targetPitch - state.pitchDeg) * Math.min(1, dt * 3.2);
  const targetBank = input.roll * 62; // stick maps to +/-62 deg bank
  state.bankDeg += (targetBank - state.bankDeg) * Math.min(1, dt * 3.6);
  const turnRate = (state.bankDeg / 60) * FLIGHT.turnRateDegPerSecAtBank60;
  state.headingDeg = (state.headingDeg + turnRate * dt + 360) % 360;

  // --- Mouse nudges the nose a little (gunsight steering). ---
  state.headingDeg = (state.headingDeg - input.mouseX * 6 * dt + 360) % 360;
  state.pitchDeg = Math.max(-25, Math.min(25, state.pitchDeg - input.mouseY * 4 * dt));

  // --- Vertical speed: throttle and pitch decide climb or sink. ---
  const speedMs = state.speedKt * 0.514444;
  let vsMs = Math.sin(state.pitchDeg * DEG) * speedMs;
  if (state.speedKt < FLIGHT.minSpeedKt) {
    vsMs -= (FLIGHT.minSpeedKt - state.speedKt) * 0.25; // stall sink
  }
  if (state.throttle < 0.15 && state.speedKt < 140) vsMs -= 6; // idle sink
  state.verticalSpeedFpm = vsMs * 196.85;

  // --- Move along the heading. ---
  const headingRad = state.headingDeg * DEG;
  const dx = Math.sin(headingRad) * speedMs * dt;
  const dz = -Math.cos(headingRad) * speedMs * dt;
  state.x += dx;
  state.z += dz;
  state.y += vsMs * dt;
  state.distanceFlownM += Math.hypot(dx, dz);

  // --- Soft boundary: the valley bends the pilot back, never a wall. ---
  const dist = Math.hypot(state.x, state.z);
  if (dist > WORLD.bounds) {
    state.headingDeg = (state.headingDeg + 90 * dt + 360) % 360;
  }

  // --- Fuel: full throttle drinks, idle sips. Empty tank = flameout glide. ---
  const burn = FLIGHT.fuelBurnPerSecAtIdle
    + (FLIGHT.fuelBurnPerSecAtFull - FLIGHT.fuelBurnPerSecAtIdle) * state.throttle;
  state.fuelPercent = Math.max(0, state.fuelPercent - burn * dt);
  if (state.fuelPercent <= 0) state.throttle = 0; // flameout: glide only

  // --- Terrain: fly into rock and the hull pays; land on the strip and it counts. ---
  const ground = heightAt(state.x, state.z);
  const clearance = state.y - ground;
  // Contact: rock at clearance <= 0, but on the strip the wheels touch at
  // clearance ~2 m (the jet's centre sits 3 m up when parked). Without the
  // strip allowance a jet that levels off a hand's breadth above the strip
  // floats forever instead of landing.
  const overRunwayEarly = isOverRunway(state.x, state.z);
  const contact = clearance <= 0
    || (overRunwayEarly && clearance <= 2 && state.speedKt <= 200);
  if (contact) {
    const overRunway = isOverRunway(state.x, state.z);
    const gentle = state.speedKt <= FLIGHT.safeTouchdownKt
      && Math.abs(state.verticalSpeedFpm) <= FLIGHT.safeTouchdownFpm;
    // state.y is the jet's centre; the strip top sits at +2 m and the
    // fuselage is ~1 m deep, so a parked jet rests at ground + 3.
    const landedY = ground + 3;
    if (overRunway && gentle && state.speedKt > 60) {
      state.landed = true;
      state.onGround = true;
      state.y = landedY;
      if (events && events.onTouchdown) events.onTouchdown({ gentle: true });
    } else if (overRunway && state.speedKt <= FLIGHT.safeTouchdownKt) {
      // Too steep onto the strip: a rough landing, hull damage, but alive.
      state.hullPercent = Math.max(0, state.hullPercent - FLIGHT.hardLandingDamage);
      state.landed = true;
      state.onGround = true;
      state.y = landedY;
      if (events && events.onTouchdown) events.onTouchdown({ gentle: false });
    } else {
      // Terrain strike: a slow, shallow graze is survivable — the hull
      // absorbs it (terrainHitDamage) and the jet bounces back up, pulling
      // out of the canyon. Only a fast or steep strike is an instant crash.
      // Three grazes (34 each) kill the hull; a lethal graze is caught by
      // the hull<=0 check below.
      const graze = state.speedKt <= 260 && Math.abs(state.verticalSpeedFpm) <= 1500;
      if (graze) {
        state.hullPercent = Math.max(0, state.hullPercent - FLIGHT.terrainHitDamage);
        state.y = ground + 15;
        state.pitchDeg = 10;
        if (events && events.onGraze) events.onGraze({ hullPercent: state.hullPercent });
      } else {
        state.crashed = true;
        state.y = ground;
        if (events && events.onTerrainHit) events.onTerrainHit({ ground, speedKt: state.speedKt });
      }
    }
  }
  if (state.hullPercent <= 0) state.crashed = true;

  return state;
}

// Runway strip: centred on the valley centre at the runway z, from
// runwayCenterZ - L/2 to + L/2.
export function isOverRunway(x, z) {
  return Math.abs(x - runwayCenterX()) <= WORLD.runwayWidth / 2
    && Math.abs(z - WORLD.runwayCenterZ) <= WORLD.runwayLength / 2;
}

// HUD conversions.
export function altitudeFt(state) { return Math.max(0, Math.round(state.y * 3.28084)); }
export function speedKt(state) { return Math.round(state.speedKt); }
export function headingDeg(state) { return Math.round(state.headingDeg); }
