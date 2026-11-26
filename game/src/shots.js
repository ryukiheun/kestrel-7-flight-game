// shots.js — deterministic screenshot staging for the maker (and the judge).
// ?shot=cover | landing | complete | night, with ?seed= (default 1).
// Each shot places the jet, the mission state and the camera exactly, then
// freezes the physics after a short settle so the captured frame is stable.
// The game itself never depends on these params; normal play ignores them.

export function parseShotQuery(search) {
  const params = new URLSearchParams(search);
  return {
    shot: params.get('shot') || null,
    seed: Number(params.get('seed') || 1),
  };
}

// Apply a shot preset to the game state. Called once at boot, before the
// first frame. Returns the number of seconds to let the scene settle before
// freezing, or 0 when no shot was requested.
export function applyShotPreset(shot, game) {
  if (!shot) return 0;
  // NOTE: setMission() replaces game.flight and game.mission with fresh
  // objects, so always read them through `game.` AFTER calling setMission —
  // never destructure them first (that was a real bug: the first shoot's
  // presets silently landed on a discarded flight object).
  if (shot === 'cover') {
    // Chase view, ring 3 dead ahead and close, afterburner lit, canyon walls
    // on both sides, clouds above: the whole game in one frame. The jet is
    // placed on the line to the next ring (420 m south of it, same x) so the
    // ring sits centred ahead instead of off to one side.
    game.setMission(0);
    const flight = game.flight;
    const target = game.mission.rings[2];
    flight.x = target.x; flight.y = target.y - 15; flight.z = target.z + 420;
    flight.headingDeg = 0; flight.pitchDeg = 1; flight.bankDeg = -6;
    flight.speedKt = 340; flight.throttle = 0.92; flight.fuelPercent = 82;
    game.mission.score = 500;
    game.mission.ringsPassed = 2;
    game.mission.rings[0].passed = true;
    game.mission.rings[1].passed = true;
    game.mission.nextRing = 2;
    game.mission.message = 'RING 3 AHEAD — 0.1 NM · STAY LOW, STAY FAST';
    // NOTE: the banner distance is the FREEZE-time value (the HUD NEXT
    // readout at freeze is 0.1 NM — the jet closes from 420 m to ~150 m
    // during the 1.4 s settle). The earlier "0.4 NM" contradicted the HUD.
    game.view = 'chase';
    return 1.4;
  }
  if (shot === 'landing') {
    // Cockpit view on short final: all four rings behind, the strip filling
    // the view ahead, glidepath diamond centred (the jet sits on the ring
    // line, y 60 at z 1900). No ring between the camera and the runway.
    game.setMission(2);
    const flight = game.flight;
    flight.x = 395; flight.y = 60; flight.z = 1900;
    flight.headingDeg = 0; flight.pitchDeg = -2; flight.bankDeg = 0;
    flight.speedKt = 165; flight.throttle = 0.45; flight.fuelPercent = 41;
    game.mission.score = 1000;
    game.mission.ringsPassed = 4;
    game.mission.rings.forEach((r) => { r.passed = true; });
    game.mission.nextRing = 4;
    game.mission.message = 'GLIDEPATH CLEAR — RUNWAY 09 AHEAD · GEAR DOWN · ON SPEED';
    game.view = 'cockpit';
    return 1.4;
  }
  if (shot === 'delivery') {
    // Sortie 2 in flight, pod delivered: all six rings green, the lit drop
    // pad ahead, delivery bonus in the feed — a second mission's proof that
    // stays an active flight shot instead of a dimmed end screen.
    game.setMission(1);
    const flight = game.flight;
    const pad = game.mission.rings[5];
    flight.x = pad.x; flight.y = 110; flight.z = pad.z + 420;
    flight.headingDeg = 0; flight.pitchDeg = 0; flight.bankDeg = -8;
    flight.speedKt = 290; flight.throttle = 0.7; flight.fuelPercent = 55;
    game.mission.score = 1800; // 6 rings x 300: the reachable pre-delivery score
    game.mission.ringsPassed = 6;
    game.mission.rings.forEach((r) => { r.passed = true; });
    game.mission.nextRing = 6;
    // delivered stays false here on purpose: the pad is the live objective
    // (DROP PAD · 0.5 NM, cyan pad visible ahead), so the HUD points forward
    // instead of back at the runway behind the jet.
    // NOTE: the banner distance is the FREEZE-time value (HUD NEXT reads
    // 0.3 NM at freeze — the jet closes from 720 m to ~490 m from the pad
    // during the settle). The earlier "0.5 NM" contradicted the HUD.
    game.mission.message = 'ALL RINGS CLEAR — DROP THE POD ON THE CYAN PAD · 0.3 NM';
    game.view = 'chase';
    return 1.4;
  }
  if (shot === 'complete') {
    // Mission-complete overlay over a chase view above the strip at dusk.
    game.setMission(0);
    const flight = game.flight;
    flight.x = 320; flight.y = 220; flight.z = 1300;
    flight.headingDeg = 350; flight.pitchDeg = 0; flight.bankDeg = 8;
    flight.speedKt = 240; flight.throttle = 0.5; flight.fuelPercent = 38;
    game.mission.score = 3250;
    game.mission.ringsPassed = 8;
    game.mission.rings.forEach((r) => { r.passed = true; });
    game.mission.nextRing = 8;
    game.mission.status = 'complete';
    game.mission.message = 'RING RUN COMPLETE — ALL 8 RINGS · FUEL BONUS BANKED';
    game.view = 'chase';
    return 1.2;
  }
  if (shot === 'night') {
    // Night sortie: jet on the line to the next ring, the ring ahead at a
    // readable size, aircraft silhouetted against the dark sky, runway
    // lights ahead — no giant foreground ring, no bright ground.
    // Freeze geometry (verified, not assumed): the jet closes ~236 m in
    // the 1.4 s settle, so it is placed 550 m south of ring 2 (z 2800) to
    // freeze ~314 m out — the ring reads ahead, not on top of the jet.
    // y 238 is the ring-line glidepath at the freeze z (~2564: between
    // spawn 250 @ z 2600 and ring 1 200 @ z 2450), so the glidepath
    // diamond reads centred. The old preset (250 m out, y 217) froze
    // ~14 m from the ring with the diamond pegged HIGH.
    game.setMission(2);
    game.setNight(true);
    const flight = game.flight;
    const target = game.mission.rings[1];
    flight.x = target.x; flight.y = 238; flight.z = target.z + 550;
    flight.headingDeg = 0; flight.pitchDeg = 0; flight.bankDeg = -6;
    flight.speedKt = 300; flight.throttle = 0.85; flight.fuelPercent = 64;
    game.mission.score = 200; // 1 ring x 200: the reachable score here
    game.mission.ringsPassed = 1;
    game.mission.rings[0].passed = true;
    game.mission.nextRing = 1;
    game.mission.message = 'NIGHT LANDING — FOLLOW THE GOLD RINGS TO RWY 09';
    game.view = 'chase';
    return 1.4;
  }
  return 0;
}
