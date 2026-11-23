// vehicles.js — every vehicle is built from code: the hero car is a bevelled
// extruded body (rounded, 3/4 rear read), never a boxy slab. Police cars carry
// a full-word POLICE door decal on a wide canvas so the word is never cut.
// Cylinders/spheres use 24+ segments; flatShading is false on organic shapes.
import * as THREE from 'three';
import { mulberry32, rand, pick, TAU } from './utils.js';
import { policeDoorTexture } from './textures.js';

function std(color, rough = 0.5, metal = 0.25) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: false });
}
const TIRE = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95, flatShading: false });
const HUB = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.3, metalness: 0.8, flatShading: false });
const GLASS = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.6, flatShading: false });

export function makeWheel(radius = 0.42, width = 0.32) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 28), TIRE);
  tire.rotation.x = Math.PI / 2;
  tire.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.04, 24), HUB);
  hub.rotation.x = Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.55, 0.03, 8, 24), std(0x22262c, 0.5, 0.5));
  ring.position.z = width / 2 + 0.01;
  g.add(tire); g.add(hub); g.add(ring);
  return g;
}

// Rounded car body: a side-profile shape extruded across the width with a bevel.
// The bevel is what makes the silhouette read smooth instead of slab-sided.
function roundedBody(length, height, width, colour, bevel = 0.16) {
  const L = length / 2, H = height;
  const s = new THREE.Shape();
  s.moveTo(-L + 0.4, 0.28);
  s.quadraticCurveTo(-L, 0.32, -L, 0.62);          // rear, rounded
  s.quadraticCurveTo(-L + 0.1, H * 0.72, -L * 0.55, H * 0.88); // rear deck -> cabin base
  s.quadraticCurveTo(-L * 0.2, H, L * 0.25, H * 0.96);         // roofline
  s.quadraticCurveTo(L * 0.62, H * 0.9, L * 0.78, H * 0.62);   // hood slope
  s.quadraticCurveTo(L, 0.55, L, 0.34);             // nose
  s.quadraticCurveTo(L, 0.26, L - 0.3, 0.26);
  s.lineTo(-L + 0.4, 0.26);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 4, steps: 1, curveSegments: 16,
  });
  geo.translate(0, 0, -width / 2);
  const mesh = new THREE.Mesh(geo, std(colour, 0.32, 0.35));
  mesh.castShadow = true;
  return mesh;
}

function cabinMesh(length, height, width, colour) {
  // Greenhouse: a second, smaller bevelled extrude — tumblehome roof.
  const L = length / 2;
  const s = new THREE.Shape();
  s.moveTo(-L, 0.1);
  s.quadraticCurveTo(-L * 0.9, height * 0.75, -L * 0.45, height);
  s.quadraticCurveTo(0, height * 1.08, L * 0.5, height * 0.96);
  s.quadraticCurveTo(L * 0.95, height * 0.7, L, 0.1);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: width, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 3, steps: 1, curveSegments: 12,
  });
  geo.translate(0, 0, -width / 2);
  const mesh = new THREE.Mesh(geo, std(colour, 0.3, 0.3));
  mesh.castShadow = true;
  return mesh;
}

function glasshouse(length, height, width) {
  const geo = new THREE.BoxGeometry(length, height, width);
  const m = new THREE.Mesh(geo, GLASS);
  return m;
}

export function makeHeroCar(colour = 0xff6a1a) {
  const car = new THREE.Group();
  const body = roundedBody(4.6, 1.05, 1.9, colour, 0.18);
  body.position.y = 0.32;
  car.add(body);
  const cabin = cabinMesh(2.3, 0.62, 1.55, colour);
  cabin.position.set(-0.25, 1.28, 0);
  car.add(cabin);
  const glass = glasshouse(2.0, 0.5, 1.6);
  glass.position.set(-0.25, 1.42, 0);
  car.add(glass);
  // Spoiler, headlights, taillights, grille.
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 1.7), std(0x1c1f26, 0.4, 0.5));
  spoiler.position.set(-2.25, 1.28, 0); spoiler.castShadow = true;
  car.add(spoiler);
  for (const s of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.08), std(0x1c1f26, 0.4, 0.5));
    strut.position.set(-2.25, 1.12, s * 0.6);
    car.add(strut);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xfff6cf, emissive: 0xffe9a8, emissiveIntensity: 1.8 }));
    head.position.set(2.32, 0.72, s * 0.62);
    car.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2020, emissiveIntensity: 1.4 }));
    tail.position.set(-2.32, 0.78, s * 0.6);
    car.add(tail);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 1.2), std(0x14161a, 0.5, 0.6));
  grille.position.set(2.33, 0.5, 0);
  car.add(grille);
  // Wheels.
  const wheels = [];
  for (const [x, z] of [[1.5, 0.98], [1.5, -0.98], [-1.5, 0.98], [-1.5, -0.98]]) {
    const w = makeWheel(0.44, 0.34);
    w.position.set(x, 0.44, z);
    car.add(w); wheels.push(w);
  }
  car.userData.wheels = wheels;
  car.userData.isHero = true;
  return car;
}

let policeDecal = null;
export function makePoliceCar() {
  if (!policeDecal) policeDecal = policeDoorTexture();
  const car = new THREE.Group();
  const body = roundedBody(4.7, 1.05, 1.95, 0xf2f4f6, 0.16);
  body.position.y = 0.32;
  car.add(body);
  const cabin = cabinMesh(2.3, 0.6, 1.6, 0xf2f4f6);
  cabin.position.set(-0.25, 1.28, 0);
  car.add(cabin);
  const glass = glasshouse(2.0, 0.48, 1.65);
  glass.position.set(-0.25, 1.42, 0);
  car.add(glass);
  // Black hood + boot band.
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 1.8), std(0x14161a, 0.5, 0.3));
  hood.position.set(1.75, 1.06, 0);
  car.add(hood);
  // Full-word POLICE decals on both doors — wide plane, whole word visible.
  // Body half-width is 1.95/2 + 0.16 bevel ≈ 1.14, so the decal sits at 1.16.
  const decalMat = new THREE.MeshStandardMaterial({ map: policeDecal, transparent: true, roughness: 0.6, flatShading: false });
  for (const s of [-1, 1]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), decalMat);
    decal.position.set(-0.1, 0.82, s * 1.16);
    decal.rotation.y = s > 0 ? 0 : Math.PI;
    car.add(decal);
  }
  // Rear POLICE (once, not per side).
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.36), decalMat);
  rear.position.set(-2.42, 0.9, 0);
  rear.rotation.y = -Math.PI / 2;
  car.add(rear);
  // Roof light bar: red + blue.
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 1.1), std(0x1c1f26, 0.4, 0.5));
  bar.position.set(-0.25, 1.98, 0);
  car.add(bar);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2.2 }));
  red.position.set(-0.25, 2.0, 0.28);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 2.2 }));
  blue.position.set(-0.25, 2.0, -0.28);
  car.add(red); car.add(blue);
  car.userData.strobe = { red, blue };
  for (const [x, z] of [[1.5, 0.99], [1.5, -0.99], [-1.5, 0.99], [-1.5, -0.99]]) {
    const w = makeWheel(0.44, 0.34);
    w.position.set(x, 0.44, z);
    car.add(w);
  }
  car.userData.isPolice = true;
  return car;
}

const TRAFFIC_COLOURS = [0x39c6ff, 0xffc93c, 0x7ddc4f, 0xe8e4da, 0x2a2f38, 0xff8fb3, 0x9a7bd6, 0x3ddc97];
export function makeTrafficCar(rng) {
  const colour = pick(rng, TRAFFIC_COLOURS);
  const car = new THREE.Group();
  const body = roundedBody(4.2, 0.95, 1.8, colour, 0.14);
  body.position.y = 0.3;
  car.add(body);
  const cabin = cabinMesh(2.0, 0.55, 1.45, colour);
  cabin.position.set(-0.2, 1.16, 0);
  car.add(cabin);
  const glass = glasshouse(1.8, 0.44, 1.5);
  glass.position.set(-0.2, 1.3, 0);
  car.add(glass);
  for (const [x, z] of [[1.35, 0.92], [1.35, -0.92], [-1.35, 0.92], [-1.35, -0.92]]) {
    const w = makeWheel(0.4, 0.3);
    w.position.set(x, 0.4, z);
    car.add(w);
  }
  return car;
}

export function makeScooter(colour = 0xff5a8a) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.5), std(colour, 0.4, 0.3));
  body.position.y = 0.55; body.castShadow = true;
  g.add(body);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.44), std(0x1c1f26, 0.8));
  seat.position.set(-0.3, 0.82, 0);
  g.add(seat);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.5), GLASS);
  shield.position.set(0.68, 0.95, 0); shield.rotation.z = -0.35;
  g.add(shield);
  const wheelF = makeWheel(0.26, 0.16); wheelF.position.set(0.62, 0.26, 0);
  const wheelB = makeWheel(0.26, 0.16); wheelB.position.set(-0.62, 0.26, 0);
  g.add(wheelF); g.add(wheelB);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff6cf, emissive: 0xffe9a8, emissiveIntensity: 1.6 }));
  lamp.position.set(0.78, 0.62, 0);
  g.add(lamp);
  return g;
}

export function makeTank() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.1, 2.6), std(0x4a5a3a, 0.7, 0.2));
  hull.position.y = 0.85; hull.castShadow = true;
  g.add(hull);
  const trackMat = std(0x1c1f26, 0.9);
  for (const s of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.7, 0.7), trackMat);
    track.position.set(0, 0.45, s * 1.25);
    track.castShadow = true;
    g.add(track);
  }
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.7, 20), std(0x55663f, 0.7, 0.2));
  turret.position.set(-0.2, 1.7, 0); turret.castShadow = true;
  g.add(turret);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 3.4, 12), std(0x3a4a2e, 0.6, 0.3));
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(2.4, 1.75, 0);
  g.add(barrel);
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.16, 14), std(0x3a4a2e, 0.7));
  hatch.position.set(-0.2, 2.1, 0);
  g.add(hatch);
  return g;
}

export function makeHeli() {
  const g = new THREE.Group();
  // KPD air unit: light grey-white body so it reads against a bright sky —
  // a near-black heli renders as a blob from below.
  const bodyMat = std(0xe8ecf0, 0.4, 0.2);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 28, 20), bodyMat);
  body.scale.set(1.9, 1.05, 1.15);
  body.castShadow = true;
  g.add(body);
  // Blue cheatline along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.34, 2.32), std(0x1f4fd8, 0.5, 0.2));
  stripe.position.set(0.1, 0.05, 0);
  g.add(stripe);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), GLASS);
  glass.scale.set(1.1, 0.75, 0.9);
  glass.position.set(1.9, 0.25, 0);
  g.add(glass);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 4.6, 12), bodyMat);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-3.6, 0.5, 0);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.16), std(0x1f4fd8, 0.4, 0.3));
  fin.position.set(-5.7, 1.1, 0);
  g.add(fin);
  // Skids.
  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8), std(0x8a929c, 0.4, 0.6));
    skid.rotation.z = Math.PI / 2;
    skid.position.set(0.2, -1.55, s * 0.95);
    g.add(skid);
  }
  // Main rotor (spins) + tail rotor.
  const rotor = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.06, 0.34), std(0x14161a, 0.5, 0.4));
    blade.rotation.y = (i / 4) * Math.PI;
    rotor.add(blade);
  }
  rotor.position.y = 1.85;
  g.add(rotor);
  const tailRotor = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.2), std(0x14161a, 0.5, 0.4));
    blade.rotation.x = (i / 2) * Math.PI;
    tailRotor.add(blade);
  }
  tailRotor.position.set(-5.7, 0.9, 0.35);
  tailRotor.rotation.z = Math.PI / 2;
  g.add(tailRotor);
  // Searchlight cone: additive, translucent — the visible beam.
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(7, 26, 20, 1, true), beamMat);
  beam.position.set(1.2, -13, 0);
  beam.rotation.z = 0.5;
  g.add(beam);
  const spot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff6cf, emissive: 0xffe9a8, emissiveIntensity: 3 }));
  spot.position.set(1.6, -1.2, 0);
  g.add(spot);
  g.userData.rotor = rotor;
  g.userData.tailRotor = tailRotor;
  g.userData.beam = beam;
  return g;
}
