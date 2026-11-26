// render.js — the 3D scene: sky, canyon, runway, rings, the jet and the camera.
// One job: build the scene once and, every frame, put the jet and the camera
// where flight.js says they are. The camera never fights the pilot: chase
// view trails smoothly, cockpit view sits fixed at the canopy.

import { WORLD } from './config.js';
import {
  buildTerrainMesh, buildRunway, buildSpires, buildGroundDetail, buildClouds, buildSun, heightAt,
} from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { dropPadPosition } from './missions.js';

const DEG = Math.PI / 180;

export function createRenderer(canvas, night) {
  const THREE = window.THREE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(night ? 0x0b1026 : 0x7fb8e8);
  scene.fog = new THREE.Fog(night ? 0x0b1026 : 0x9cc8e8, 900, 3600);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 9000);
  camera.position.set(0, 200, 1800);

  scene.add(buildTerrainMesh(THREE));
  scene.add(buildRunway(THREE));
  scene.add(buildSpires(THREE));
  scene.add(buildGroundDetail(THREE));
  scene.add(buildClouds(THREE, night));
  const sun = buildSun(THREE, night);
  scene.add(sun.group);
  const sunLight = sun.light;
  const sunHemi = sun.hemi;

  const { group: jet, updateAfterburner } = buildAircraft(THREE);
  scene.add(jet);

  // Target rings: gold torus, next one brighter and larger.
  const ringGroup = new THREE.Group();
  ringGroup.name = 'targetRings';
  scene.add(ringGroup);
  const ringMatNext = new THREE.MeshBasicMaterial({ color: 0xffcf3f });
  const ringMatDone = new THREE.MeshBasicMaterial({ color: 0x2fae6e });
  const ringMatLater = new THREE.MeshBasicMaterial({ color: 0xff9d2e, transparent: true, opacity: 0.75 });
  let ringMeshes = [];

  function buildRings(rings) {
    // Remove the previous mission's meshes, not the wrapper objects:
    // ringGroup.remove(entry) was a no-op (entry is {mesh, beacon}, not an
    // Object3D), so every mission switch left the old rings floating in the
    // canyon — 22 torus meshes after one switch, orange ghosts in the
    // screenshots. Remove mesh + beacon and dispose their geometries
    // (the materials are shared, so they stay).
    for (const entry of ringMeshes) {
      ringGroup.remove(entry.mesh);
      ringGroup.remove(entry.beacon);
      entry.mesh.geometry.dispose();
      entry.beacon.geometry.dispose();
    }
    ringMeshes = rings.map((ring) => {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(ring.radius, 2.2, 10, 40), ringMatLater);
      mesh.position.set(ring.x, ring.y, ring.z);
      mesh.rotation.y = 0;
      ringGroup.add(mesh);
      // A small beacon light on top of each ring so it reads from far away.
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(3, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe27a }),
      );
      beacon.position.set(ring.x, ring.y + ring.radius + 4, ring.z);
      ringGroup.add(beacon);
      return { mesh, beacon };
    });
  }

  // Drop pad for the delivery sortie: a lit cyan circle on the valley floor.
  const pad = dropPadPosition();
  const padMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 26, 2, 24),
    new THREE.MeshLambertMaterial({ color: 0x1fa8a0, emissive: 0x0a5a54 }),
  );
  padMesh.position.set(pad.x, pad.y + 1, pad.z);
  scene.add(padMesh);
  const padRing = new THREE.Mesh(
    new THREE.TorusGeometry(30, 1.6, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0x7fe7ff }),
  );
  padRing.rotation.x = Math.PI / 2;
  padRing.position.set(pad.x, pad.y + 3, pad.z);
  scene.add(padRing);

  // Chase camera state: smoothed position and look target.
  const camPos = new THREE.Vector3(0, 200, 1800);
  const camLook = new THREE.Vector3(0, 150, 1500);

  function updateCamera(flight, view, dt) {
    const headingRad = flight.headingDeg * DEG;
    const fx = Math.sin(headingRad);
    const fz = -Math.cos(headingRad);
    if (view === 'cockpit') {
      // At the canopy, looking along the nose; bank rolls the horizon.
      const px = flight.x + fx * 1.2;
      const py = flight.y + 0.9;
      const pz = flight.z + fz * 1.2;
      camera.position.set(px, py, pz);
      const look = new THREE.Vector3(
        flight.x + fx * 120 - Math.sin(flight.bankDeg * DEG) * 8,
        flight.y + Math.sin(flight.pitchDeg * DEG) * 120,
        flight.z + fz * 120,
      );
      camera.up.set(-Math.sin(flight.bankDeg * DEG), Math.cos(flight.bankDeg * DEG), 0);
      camera.lookAt(look);
      camera.fov = 72;
      camera.updateProjectionMatrix();
      jet.visible = false;
      return;
    }
    // Chase: behind and above, easing toward the ideal spot so the camera
    // never snaps when the pilot banks hard.
    jet.visible = true;
    camera.up.set(0, 1, 0);
    camera.fov = 62;
    camera.updateProjectionMatrix();
    const back = 13 + flight.speedKt * 0.005;
    const up = 4 + flight.speedKt * 0.003;
    const tx = flight.x - fx * back;
    const ty = flight.y + up;
    const tz = flight.z - fz * back;
    const k = Math.min(1, dt * 5);
    camPos.x += (tx - camPos.x) * k;
    camPos.y += (ty - camPos.y) * k;
    camPos.z += (tz - camPos.z) * k;
    camera.position.copy(camPos);
    camLook.x += (flight.x + fx * 60 - camLook.x) * Math.min(1, dt * 7);
    camLook.y += (flight.y - 2 - camLook.y) * Math.min(1, dt * 7);
    camLook.z += (flight.z + fz * 60 - camLook.z) * Math.min(1, dt * 7);
    camera.lookAt(camLook);
  }

  function updateJet(flight, timeSec) {
    jet.position.set(flight.x, flight.y, flight.z);
    // Three.js rotation order: yaw (heading) then pitch then roll.
    jet.rotation.order = 'YXZ';
    jet.rotation.y = flight.headingDeg * DEG;
    jet.rotation.x = -flight.pitchDeg * DEG;
    jet.rotation.z = -flight.bankDeg * DEG;
    updateAfterburner(flight.throttle, timeSec);
  }

  function updateRings(mission, timeSec) {
    mission.rings.forEach((ring, i) => {
      const entry = ringMeshes[i];
      if (!entry) return;
      const mat = ring.passed ? ringMatDone : (i === mission.nextRing ? ringMatNext : ringMatLater);
      entry.mesh.material = mat;
      entry.beacon.material = mat;
      const pulse = i === mission.nextRing ? 1 + Math.sin(timeSec * 4) * 0.06 : 1;
      entry.mesh.scale.set(pulse, pulse, 1);
      entry.mesh.rotation.y = timeSec * 0.25;
      entry.beacon.visible = !ring.passed;
    });
  }

  // Project a world point to CSS pixels for the HUD target box.
  function projectToScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    if (v.z > 1) return null; // behind the camera
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  return {
    THREE, renderer, scene, camera,
    buildRings, updateCamera, updateJet, updateRings, projectToScreen, resize,
    render() { renderer.render(scene, camera); },
    setNight(nightMode) {
      scene.background = new THREE.Color(nightMode ? 0x0b1026 : 0x7fb8e8);
      scene.fog = new THREE.Fog(nightMode ? 0x0b1026 : 0x9cc8e8, 900, 3600);
      // Night ground must read as night: dim the sun and sky light so the
      // valley floor goes dark while the lit rings and lamps stay bright.
      sunLight.intensity = nightMode ? 0.4 : 1.55;
      sunHemi.intensity = nightMode ? 0.35 : 1.05;
    },
  };
}

export { heightAt, WORLD };
