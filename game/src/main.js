// main.js — bootstrap and the game loop for KESTREL-7: Canyon Run.
// One job: own the state machine (menu → flying → complete/crashed), step the
// physics and the mission once a frame, and hand the rest to render.js/hud.js.
// Original game: KESTREL-7, Vermilion Wing, Ember Canyon. No commercial names.

import { MISSIONS } from './config.js';
import { createInput } from './input.js';
import { createFlightState, stepFlight, altitudeFt, speedKt, headingDeg } from './flight.js';
import { createMissionState, stepMission, nextObjective } from './missions.js';
import { heightAt } from './terrain.js';
import { createRenderer } from './render.js';
import { createHud, updateHud } from './hud.js';
import { parseShotQuery, applyShotPreset } from './shots.js';

const canvas = document.getElementById('game');
const hudRoot = document.getElementById('hud-root');
const hud = createHud(hudRoot);
const input = createInput(canvas);

const game = {
  flight: createFlightState(),
  mission: createMissionState(0),
  view: 'chase', // chase | cockpit
  night: false,
  paused: false,
  showMenu: true,
  started: false,
  timeSec: 0,
  renderer: null,
  shotFreezeAt: 0, // seconds of game time after which a ?shot= freezes
  shotFrozen: false,
};

game.setMission = function setMission(index) {
  game.mission = createMissionState(index);
  game.flight = createFlightState();
  // Each mission spawns where its first objective is: the night landing
  // starts south of the strip so the whole glidepath is flown.
  const spawn = game.mission.spawn;
  game.flight.x = spawn.x;
  game.flight.y = spawn.y;
  game.flight.z = spawn.z;
  game.flight.headingDeg = spawn.headingDeg;
  game.night = !!MISSIONS[index].night;
  if (game.renderer) {
    game.renderer.setNight(game.night);
    game.renderer.buildRings(game.mission.rings);
  }
  game.showMenu = false;
  game.started = true;
  game.paused = false;
};

game.setNight = function setNight(nightMode) {
  game.night = nightMode;
  if (game.renderer) game.renderer.setNight(nightMode);
};

game.renderer = createRenderer(canvas, false);
game.renderer.buildRings(game.mission.rings);

// Screenshot staging: ?shot=cover|landing|complete|night freezes a staged frame.
const shot = parseShotQuery(window.location.search);
if (shot.shot) {
  game.showMenu = false;
  game.started = true;
  const settleSec = applyShotPreset(shot.shot, game);
  game.renderer.setNight(game.night);
  game.renderer.buildRings(game.mission.rings);
  if (settleSec > 0) game.shotFreezeAt = settleSec;
}

function restartMission() {
  game.setMission(game.mission.def.index);
}

function crashFlash() {
  hud.flash.classList.add('show');
  setTimeout(() => hud.flash.classList.remove('show'), 450);
}

let lastTs = performance.now();

function frame(ts) {
  // dt is clamped both ways: a stale first rAF timestamp after a navigation
  // can arrive earlier than the module's performance.now(), which once made
  // dt negative and ran the physics backwards for a frame (heading -5 deg).
  const dt = Math.max(0, Math.min(0.05, (ts - lastTs) / 1000));
  lastTs = ts;
  // A frozen screenshot frame must be a frozen frame: ring rotation and
  // afterburner flicker run off game.timeSec, so the clock stops too.
  if (!game.shotFrozen) game.timeSec += dt;

  // --- Edge-triggered keys. ---
  if (input.wasPressed('Space')) {
    if (game.showMenu) game.setMission(0);
  }
  if (input.wasPressed('KeyC')) {
    game.view = game.view === 'chase' ? 'cockpit' : 'chase';
  }
  if (input.wasPressed('KeyP')) game.paused = !game.paused;
  if (input.wasPressed('KeyR')) restartMission();
  if (input.wasPressed('Digit1')) game.setMission(0);
  if (input.wasPressed('Digit2')) game.setMission(1);
  if (input.wasPressed('Digit3')) game.setMission(2);
  if (input.wasPressed('KeyM')) {
    // Sound is not implemented in this build; M is a no-op kept for the
    // controls line so the HUD never promises a key that does nothing.
  }

  // Menu button starts the first sortie.
  const takeoff = hud.get('hud-takeoff');
  if (takeoff && !takeoff.dataset.bound) {
    takeoff.dataset.bound = '1';
    takeoff.addEventListener('click', () => game.setMission(0));
  }

  const controls = input.poll();
  // Staged screenshots (?shot=) must be deterministic: stray mousemove
  // events in the capture harness would otherwise steer the nose a few
  // degrees during the settle. Real play is unaffected.
  if (game.shotFreezeAt > 0) {
    controls.mouseX = 0;
    controls.mouseY = 0;
  }
  const frozen = game.shotFrozen || game.paused || game.showMenu || !game.started;

  if (!frozen) {
    stepFlight(game.flight, controls, dt, heightAt, {
      onTerrainHit: () => {
        crashFlash();
        game.mission.landing = null;
      },
      onGraze: (info) => {
        crashFlash();
        game.mission.message = `TERRAIN STRIKE — HULL ${Math.round(info.hullPercent)}% — PULL UP!`;
      },
      onTouchdown: (info) => {
        game.mission.landing = info;
        if (!info.gentle) crashFlash();
      },
    });
    stepMission(game.mission, game.flight, dt);
  }

  // Screenshot freeze: after the settle time, stop the physics so the
  // captured frame is identical on every run.
  if (game.shotFreezeAt > 0 && game.timeSec >= game.shotFreezeAt && !game.shotFrozen) {
    game.shotFrozen = true;
  }

  // --- Render + HUD. ---
  game.renderer.updateJet(game.flight, game.timeSec);
  game.renderer.updateCamera(game.flight, game.view, frozen ? 0 : dt);
  game.renderer.updateRings(game.mission, game.timeSec);
  game.renderer.render();

  const objective = nextObjective(game.mission, game.flight);
  updateHud(hud, {
    flight: game.flight,
    mission: game.mission,
    objective,
    view: game.view,
    paused: game.paused,
    showMenu: game.showMenu,
  });

  // Target box: project the next objective onto the screen.
  const screen = game.renderer.projectToScreen(objective.x, objective.y, objective.z);
  if (screen && objective.kind === 'ring' && !game.showMenu) {
    hud.targetBox.style.display = 'block';
    hud.targetBox.style.left = `${screen.x}px`;
    hud.targetBox.style.top = `${screen.y}px`;
    hud.get('hud-target-tag').textContent = `RING ${game.mission.nextRing + 1}`;
  } else {
    hud.targetBox.style.display = 'none';
  }

  // Reticle follows the mouse slightly (gunsight steering feedback).
  hud.reticle.style.transform = `translate(${controls.mouseX * 26}px, ${controls.mouseY * 18}px)`;

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Expose the live numbers for debugging and for the screenshot harness.
window.__kestrel = {
  game,
  altitudeFt: () => altitudeFt(game.flight),
  speedKt: () => speedKt(game.flight),
  headingDeg: () => headingDeg(game.flight),
};
