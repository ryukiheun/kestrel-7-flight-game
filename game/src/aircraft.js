// aircraft.js — the KESTREL-7 jet, built from primitives so it reads as a jet:
// pointed nose, glass canopy, swept main wings, twin tail fins, twin nozzles
// and two afterburner flames. No imported model, no copied silhouette.

export function buildAircraft(THREE) {
  const jet = new THREE.Group();
  jet.name = 'kestrel7';

  const hullMat = new THREE.MeshLambertMaterial({ color: 0x8fa2b2, flatShading: true });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x2e3844, flatShading: true });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd8e8, flatShading: true });
  const accentMat = new THREE.MeshLambertMaterial({ color: 0xc8402e, flatShading: true });
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffa020, transparent: true, opacity: 0.9,
  });
  const flameCoreMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.95,
  });

  // Fuselage: a tapered cylinder (wide at the back, narrow at the nose).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.05, 7.4, 8), hullMat);
  fuselage.rotation.x = Math.PI / 2;
  jet.add(fuselage);

  // Nose cone: sharp point ahead.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 8), darkMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.9;
  jet.add(nose);

  // Canopy: a flattened glass bubble on top of the nose section.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), glassMat);
  canopy.scale.set(0.72, 0.55, 1.9);
  canopy.position.set(0, 0.62, -2.2);
  jet.add(canopy);

  // Main wings: swept back, thin, with a red tip stripe each side.
  function wing(side) {
    const g = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.14, 1.9), hullMat);
    panel.position.x = side * 2.6;
    panel.rotation.y = side * 0.5; // sweep back
    g.add(panel);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 1.5), accentMat);
    tip.position.x = side * 4.7;
    tip.rotation.y = side * 0.5;
    g.add(tip);
    return g;
  }
  jet.add(wing(1));
  jet.add(wing(-1));

  // Tailplane: smaller swept wings near the tail.
  function tailplane(side) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.1), hullMat);
    panel.position.set(side * 1.35, 0.1, 3.2);
    panel.rotation.y = side * 0.55;
    return panel;
  }
  jet.add(tailplane(1));
  jet.add(tailplane(-1));

  // Twin tail fins, canted outward.
  function fin(side) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 1.5), darkMat);
    f.position.set(side * 0.85, 0.9, 3.1);
    f.rotation.z = -side * 0.28;
    f.rotation.y = side * 0.35;
    return f;
  }
  jet.add(fin(1));
  jet.add(fin(-1));

  // Twin engine nozzles at the tail.
  for (const side of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 1.1, 8), darkMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(side * 0.55, -0.05, 3.9);
    jet.add(nozzle);
  }

  // Afterburner flames: outer cone + bright core, scaled by throttle each frame.
  const flames = [];
  for (const side of [-1, 1]) {
    const flame = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.4, 8), flameMat);
    outer.rotation.x = Math.PI / 2;
    outer.position.z = 2.1;
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.26, 2.2, 8), flameCoreMat);
    core.rotation.x = Math.PI / 2;
    core.position.z = 1.6;
    flame.add(outer);
    flame.add(core);
    flame.position.set(side * 0.55, -0.05, 4.3);
    jet.add(flame);
    flames.push(flame);
  }

  // Wingtip navigation lights: red port, green starboard.
  const portLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3020 }),
  );
  portLight.position.set(-4.9, 0, 0.4);
  jet.add(portLight);
  const stbdLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0x20ff60 }),
  );
  stbdLight.position.set(4.9, 0, 0.4);
  jet.add(stbdLight);

  // Registration painted on the fuselage side is faked with two thin red bars
  // (real text needs a texture; the HUD carries the KV-7 callsign instead).
  for (const side of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 2.2), accentMat);
    bar.position.set(side * 0.92, 0.1, -0.4);
    jet.add(bar);
  }

  jet.traverse((obj) => { if (obj.isMesh) obj.castShadow = false; });

  // Called every frame: flame length follows throttle, flames flicker.
  function updateAfterburner(throttle, timeSec) {
    const flicker = 0.9 + Math.sin(timeSec * 31) * 0.08 + Math.sin(timeSec * 57) * 0.05;
    const len = (0.25 + throttle * 1.15) * flicker;
    for (const flame of flames) {
      flame.scale.set(1, 1, len);
      flame.visible = throttle > 0.08;
    }
  }

  return { group: jet, updateAfterburner };
}
