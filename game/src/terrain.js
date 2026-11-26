// terrain.js — the canyon world: height function, low-poly mesh, runway,
// rock spires, clouds and sun. One style for ground and sky: warm rock,
// pale sand valley, one blue sky, one sun.
// The height function is the single source of truth: flight.js collides
// against it and render.js builds the mesh from it, so they can never disagree.

import { WORLD, mulberry32 } from './config.js';

// --- Value noise (deterministic, seeded) for the rolling hills. ---
function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296);
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return (a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz);
}
function fbm(x, z, seed) {
  return valueNoise(x * 0.0016, z * 0.0016, seed) * 0.62
    + valueNoise(x * 0.004, z * 0.004, seed + 7) * 0.28
    + valueNoise(x * 0.011, z * 0.011, seed + 13) * 0.10;
}

// Canyon profile: a valley floor along the Z axis, walls rising on both sides.
// The valley bends gently with z so the run never looks like a straight trench.
export function canyonCenterX(z) {
  return Math.sin(z * 0.00042) * 420 + Math.sin(z * 0.0011) * 120;
}

// The runway sits on the valley floor at the south end, so its x follows the
// valley centre there — the strip is never on a slope, and the final approach
// flies down the valley, not across a wall.
export function runwayCenterX() {
  return canyonCenterX(WORLD.runwayCenterZ);
}

export function heightAt(x, z) {
  const cx = canyonCenterX(z);
  const across = Math.abs(x - cx);
  const hills = fbm(x, z, 11) * 260 - 40; // rolling high ground, metres
  if (across < WORLD.canyonHalfWidth) {
    // Valley floor: nearly flat, gentle undulation.
    const floor = fbm(x * 0.4, z * 0.4, 23) * 1.2;
    // Runway pad: dead flat, blending out over 120 m, so the strip and its
    // lights never sink under a terrain bump.
    const rx = canyonCenterX(WORLD.runwayCenterZ);
    const padDx = Math.max(0, Math.abs(x - rx) - 40);
    const padDz = Math.max(0, Math.max(1000 - z, z - 2000));
    const padBlend = Math.min(1, Math.hypot(padDx, padDz) / 120);
    return floor * padBlend;
  }
  // Walls: smoothstep from floor to high ground over ~500 m of slope.
  const t = Math.min(1, (across - WORLD.canyonHalfWidth) / 520);
  const wall = t * t * (3 - 2 * t);
  return wall * (WORLD.wallHeight + hills * 0.8) + (1 - wall) * 4;
}

// Build the terrain mesh with vertex colours: sand floor, rust rock walls,
// pale scree on the slopes, dark green scrub on the high flats.
export function buildTerrainMesh(THREE) {
  const size = WORLD.size;
  const seg = WORLD.segments;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = [0.86, 0.72, 0.47];
  const rock = [0.62, 0.36, 0.24];
  const scree = [0.74, 0.58, 0.42];
  const scrub = [0.42, 0.52, 0.30];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const across = Math.abs(x - canyonCenterX(z));
    if (across < WORLD.canyonHalfWidth * 0.9) c.setRGB(...sand);
    else if (across < WORLD.canyonHalfWidth + 260) c.setRGB(...scree);
    else if (h > 240) c.setRGB(...scrub);
    else c.setRGB(...rock);
    // Slight noise in the colour so the flats never look like a flat fill.
    const n = (fbm(x * 0.05, z * 0.05, 31) - 0.5) * 0.14;
    colors[i * 3] = Math.min(1, Math.max(0, c.r + n));
    colors[i * 3 + 1] = Math.min(1, Math.max(0, c.g + n));
    colors[i * 3 + 2] = Math.min(1, Math.max(0, c.b + n));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'canyonTerrain';
  return mesh;
}

// Runway: dark strip with white centreline dashes and threshold bars,
// plus approach light poles. Sits flat on the valley floor at the south end.
export function buildRunway(THREE) {
  const group = new THREE.Group();
  group.name = 'runway09';
  const rx = runwayCenterX();
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.runwayWidth, WORLD.runwayLength),
    new THREE.MeshLambertMaterial({ color: 0x2b2f36 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(rx, 2.0, WORLD.runwayCenterZ);
  group.add(strip);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f2e8 });
  for (let z = WORLD.runwayCenterZ - WORLD.runwayLength / 2 + 60;
    z < WORLD.runwayCenterZ + WORLD.runwayLength / 2 - 40; z += 90) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(3, 42), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(rx, 2.4, z);
    group.add(dash);
  }
  // Threshold bars at both ends.
  for (const zEnd of [WORLD.runwayCenterZ - WORLD.runwayLength / 2 + 18,
    WORLD.runwayCenterZ + WORLD.runwayLength / 2 - 18]) {
    for (let k = -2; k <= 2; k++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(5, 18), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(rx + k * 8, 2.4, zEnd);
      group.add(bar);
    }
  }
  // Approach lights: two rows of small amber lamps leading to the threshold.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffb020 });
  for (let i = 1; i <= 6; i++) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 6), lampMat);
      // Approach lights lead INTO the south threshold (z = centre + half
      // length), the end a northbound landing crosses first.
      lamp.position.set(rx + side * 14, 4, WORLD.runwayCenterZ + WORLD.runwayLength / 2 + i * 55);
      group.add(lamp);
    }
  }
  return group;
}

// Rock spires: tall thin cones poking out of the walls — the canyon's teeth.
export function buildSpires(THREE) {
  const rand = mulberry32(97);
  const group = new THREE.Group();
  group.name = 'rockSpires';
  const mat = new THREE.MeshLambertMaterial({ color: 0x9a6242, flatShading: true, emissive: 0x241209 });
  const mat2 = new THREE.MeshLambertMaterial({ color: 0xb07a4e, flatShading: true, emissive: 0x2a160a });
  for (let i = 0; i < 46; i++) {
    const z = (rand() - 0.5) * 3800;
    const side = rand() > 0.5 ? 1 : -1;
    const across = WORLD.canyonHalfWidth + 120 + rand() * 700;
    const x = canyonCenterX(z) + side * across;
    const h = 90 + rand() * 190;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(14 + rand() * 26, h, 5), rand() > 0.5 ? mat : mat2);
    spire.position.set(x, heightAt(x, z) + h / 2 - 12, z);
    spire.rotation.y = rand() * Math.PI;
    group.add(spire);
  }
  return group;
}

// Clouds: flat white puff clusters drifting slowly, same style day and night.
export function buildClouds(THREE, night) {
  const rand = mulberry32(41);
  const group = new THREE.Group();
  group.name = 'clouds';
  const mat = new THREE.MeshBasicMaterial({
    color: night ? 0x9aa5c8 : 0xffffff,
    transparent: true,
    opacity: night ? 0.6 : 0.95,
  });
  for (let i = 0; i < 34; i++) {
    const puff = new THREE.Group();
    const n = 3 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(22 + rand() * 34, 7, 6), mat);
      s.position.set((rand() - 0.5) * 120, (rand() - 0.5) * 14, (rand() - 0.5) * 60);
      s.scale.y = 0.42;
      puff.add(s);
    }
    puff.position.set(
      (rand() - 0.5) * 3800,
      380 + rand() * 260,
      (rand() - 0.5) * 3800,
    );
    group.add(puff);
  }
  return group;
}

// Valley-floor detail: scrub bushes and boulders scattered along the canyon
// floor so the low ground never reads as an empty sand fill in screenshots.
// Kept clear of the runway strip.
export function buildGroundDetail(THREE) {
  const rand = mulberry32(53);
  const group = new THREE.Group();
  group.name = 'groundDetail';
  const bushMat = new THREE.MeshLambertMaterial({ color: 0x4a6b35, flatShading: true });
  const bushMat2 = new THREE.MeshLambertMaterial({ color: 0x5d7a3a, flatShading: true });
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8d7a66, flatShading: true });
  for (let i = 0; i < 170; i++) {
    const z = (rand() - 0.5) * 3800;
    const x = canyonCenterX(z) + (rand() - 0.5) * 420;
    if (Math.abs(x - runwayCenterX()) < 45 && z > 1000 && z < 2000) continue; // keep the strip clear
    const h = heightAt(x, z);
    if (rand() > 0.42) {
      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(3 + rand() * 5, 6, 5),
        rand() > 0.5 ? bushMat : bushMat2,
      );
      bush.scale.y = 0.55;
      bush.position.set(x, h + 1.5, z);
      group.add(bush);
    } else {
      const rock = new THREE.Mesh(
        new THREE.ConeGeometry(2.5 + rand() * 5, 4 + rand() * 7, 5),
        rockMat,
      );
      rock.position.set(x, h + 2, z);
      rock.rotation.y = rand() * Math.PI;
      group.add(rock);
    }
  }
  return group;
}

// Sun: a bright disc sprite plus the directional light that lights the scene.
export function buildSun(THREE, night) {
  const group = new THREE.Group();
  group.name = 'sun';
  const light = new THREE.DirectionalLight(night ? 0x9fb4ff : 0xfff2d8, night ? 0.55 : 1.55);
  light.position.set(900, 1400, -600);
  group.add(light);
  const hemi = new THREE.HemisphereLight(
    night ? 0x1c2440 : 0xbfd9ff,
    night ? 0x0c0f18 : 0x8a6a4a,
    night ? 0.5 : 1.05,
  );
  group.add(hemi);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(60, 24),
    new THREE.MeshBasicMaterial({ color: night ? 0xdfe8ff : 0xfff6c8, fog: false }),
  );
  disc.position.set(1500, 900, -2600);
  disc.lookAt(0, 0, 0);
  group.add(disc);
  return { group, light, hemi };
}
