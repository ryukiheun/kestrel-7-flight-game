// input.js — keyboard and mouse state for the pilot.
// One job: turn raw DOM events into a stable per-frame control snapshot
// (pitch, roll, throttle, view, mission keys) that flight.js consumes.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    pitch: 0, // -1 (nose down) .. +1 (nose up), from W/S or ArrowUp/Down
    roll: 0, // -1 (left) .. +1 (right), from A/D or ArrowLeft/Right
    throttleUp: false, // Shift held
    throttleDown: false, // Control held
    mouseX: 0, // -1..+1 across the window, steers the gunsight
    mouseY: 0,
    mouseDown: false,
    pressed: new Set(), // keys pressed since last consume (edge-triggered)
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    state.pressed.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  // The mouse steers only while it is moving: an absolute position left
  // parked at the screen edge used to yaw/pitch the jet forever with no
  // mouse movement. After 0.5 s of stillness the offset decays to centre.
  let lastMouseMoveAt = 0;
  function onMouseMove(event) {
    state.mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    state.mouseY = (event.clientY / window.innerHeight) * 2 - 1;
    lastMouseMoveAt = Date.now();
  }
  function onMouseDown() { state.mouseDown = true; }
  function onMouseUp() { state.mouseDown = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // Read the held keys into the per-frame snapshot. Called once per frame.
  function poll() {
    if (Date.now() - lastMouseMoveAt > 500) {
      state.mouseX = 0;
      state.mouseY = 0;
    }
    // Dead zone around centre so a resting mouse never nudges the nose.
    if (Math.abs(state.mouseX) < 0.08) state.mouseX = 0;
    if (Math.abs(state.mouseY) < 0.08) state.mouseY = 0;
    const up = keys.has('KeyW') || keys.has('ArrowUp');
    const down = keys.has('KeyS') || keys.has('ArrowDown');
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    state.pitch = (up ? 1 : 0) - (down ? 1 : 0);
    state.roll = (right ? 1 : 0) - (left ? 1 : 0);
    state.throttleUp = keys.has('ShiftLeft') || keys.has('ShiftRight');
    state.throttleDown = keys.has('ControlLeft') || keys.has('ControlRight');
    return state;
  }

  // Edge-triggered: true once for a key pressed since the last call.
  function wasPressed(code) {
    if (state.pressed.has(code)) {
      state.pressed.delete(code);
      return true;
    }
    return false;
  }

  function clearPressed() { state.pressed.clear(); }

  return { state, poll, wasPressed, clearPressed, keys };
}
