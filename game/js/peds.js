// peds.js — jointed pedestrians. Every ped is built from pivoted segments:
// upper/lower arms with elbow joints, upper/lower legs with knee joints,
// varied heights, widths and skin/shirt colours. No dolls: no round head on a
// square body — proportions are human (head ~1/7.5 of height).
import * as THREE from 'three';
import { mulberry32, rand, pick, TAU } from './utils.js';

function std(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: false });
}
const SKINS = [0x8a5a3b, 0xc98d64, 0x6b4226, 0xe8b98a, 0xa06a42];
const SHIRTS = [0xff5a3c, 0x39c6ff, 0xffc93c, 0x7ddc4f, 0xe8e4da, 0xff8fb3, 0x9a7bd6, 0x3ddc97, 0x2a7fbf, 0xf2f2f2];
const PANTS = [0x2a2f38, 0x3a4a6b, 0x5a4632, 0x6b7a5e, 0x1c1f26, 0x8a7a5e];

// Build one jointed ped. Returns { group, joints, height, walkPhase }.
export function makePed(rng, opts = {}) {
  const height = opts.height ?? rand(rng, 1.62, 1.92);
  const bulk = opts.bulk ?? rand(rng, 0.82, 1.22); // shoulder/hip width factor
  const skin = opts.skin ?? pick(rng, SKINS);
  const shirt = opts.shirt ?? pick(rng, SHIRTS);
  const pants = opts.pants ?? pick(rng, PANTS);
  const g = new THREE.Group();
  const s = height / 1.78; // scale against the reference build

  // Legs: hip pivot -> thigh -> knee pivot -> shin -> shoe.
  const legLen = 0.82 * s;
  const joints = { armL: null, armR: null, legL: null, legR: null, kneeL: null, kneeR: null, elbowL: null, elbowR: null };
  function leg(side) {
    const hip = new THREE.Group();
    hip.position.set(0, legLen, side * 0.11 * bulk * s);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075 * bulk * s, 0.065 * bulk * s, legLen * 0.52, 10), std(pants));
    thigh.position.y = -legLen * 0.26; thigh.castShadow = true;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -legLen * 0.52;
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * bulk * s, 0.05 * bulk * s, legLen * 0.48, 10), std(pants));
    shin.position.y = -legLen * 0.24; shin.castShadow = true;
    knee.add(shin);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.09 * s, 0.13 * bulk * s), std(0x1c1f26, 0.9));
    shoe.position.set(0.04 * s, -legLen * 0.48, 0);
    knee.add(shoe);
    hip.add(knee);
    g.add(hip);
    return { hip, knee };
  }
  const lL = leg(-1), lR = leg(1);
  joints.legL = lL.hip; joints.kneeL = lL.knee;
  joints.legR = lR.hip; joints.kneeR = lR.knee;

  // Torso: rounded box (bevelled look via a scaled sphere + box mix).
  const torsoH = 0.58 * s;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42 * bulk * s, torsoH, 0.24 * bulk * s), std(shirt));
  torso.position.y = legLen + torsoH / 2;
  torso.castShadow = true;
  g.add(torso);
  // Shoulders: a soft rounded cap so the silhouette is not a slab.
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.21 * bulk * s, 16, 12), std(shirt));
  shoulders.scale.set(1.05, 0.5, 0.62);
  shoulders.position.y = legLen + torsoH - 0.02;
  g.add(shoulders);

  // Arms: shoulder pivot -> upper arm -> elbow pivot -> forearm -> hand.
  const armLen = 0.62 * s;
  function arm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0, legLen + torsoH - 0.06, side * 0.26 * bulk * s);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.045 * s, armLen * 0.5, 10), std(shirt));
    upper.position.y = -armLen * 0.25; upper.castShadow = true;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -armLen * 0.5;
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.042 * s, 0.038 * s, armLen * 0.5, 10), std(skin));
    fore.position.y = -armLen * 0.25; fore.castShadow = true;
    elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 10, 8), std(skin));
    hand.position.y = -armLen * 0.52;
    elbow.add(hand);
    shoulder.add(elbow);
    g.add(shoulder);
    return { shoulder, elbow };
  }
  const aL = arm(-1), aR = arm(1);
  joints.armL = aL.shoulder; joints.elbowL = aL.elbow;
  joints.armR = aR.shoulder; joints.elbowR = aR.elbow;

  // Neck + head: sphere (smooth), with hair cap on top half.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.06 * s, 0.1 * s, 10), std(skin));
  neck.position.y = legLen + torsoH + 0.05;
  g.add(neck);
  const headY = legLen + torsoH + 0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115 * s, 20, 16), std(skin));
  head.position.y = headY;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 18, 12, 0, TAU, 0, Math.PI * 0.55), std(opts.hair ?? pick(rng, [0x1c1f26, 0x3a2a1a, 0x6b6b6b, 0x2a1a0e])));
  hair.position.y = headY + 0.015;
  g.add(hair);
  // Optional cap.
  if (rng() < 0.3) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.13 * s, 0.06 * s, 14), std(pick(rng, [0xff5a3c, 0x39c6ff, 0x1c1f26])));
    cap.position.y = headY + 0.1;
    g.add(cap);
  }
  g.userData.height = height;
  return { group: g, joints, height, walkPhase: rng() * TAU, speed: rand(rng, 0.8, 1.4) };
}

// Walk-cycle: opposite arm/leg swing, knees and elbows bend.
export function animatePed(ped, dt, moving = true) {
  if (!moving) return;
  ped.walkPhase += dt * 6.5 * ped.speed;
  const ph = ped.walkPhase;
  const swing = 0.55;
  ped.joints.legL.rotation.x = Math.sin(ph) * swing;
  ped.joints.legR.rotation.x = Math.sin(ph + Math.PI) * swing;
  ped.joints.kneeL.rotation.x = Math.max(0, -Math.sin(ph + 0.6)) * 0.9;
  ped.joints.kneeR.rotation.x = Math.max(0, -Math.sin(ph + Math.PI + 0.6)) * 0.9;
  ped.joints.armL.rotation.x = Math.sin(ph + Math.PI) * swing * 0.7;
  ped.joints.armR.rotation.x = Math.sin(ph) * swing * 0.7;
  ped.joints.elbowL.rotation.x = -0.35 - Math.max(0, Math.sin(ph)) * 0.3;
  ped.joints.elbowR.rotation.x = -0.35 - Math.max(0, Math.sin(ph + Math.PI)) * 0.3;
  ped.group.position.y = Math.abs(Math.sin(ph)) * 0.03;
}

// A downed enemy: clearly a body — red shirt, limbs splayed, red ring beneath.
export function makeDownedEnemy() {
  const g = new THREE.Group();
  const rng = mulberry32(99);
  const ped = makePed(rng, { shirt: 0xd42a1e, pants: 0x2a2f38, height: 1.8 });
  // Splay the limbs: arms out, one leg bent at the knee.
  ped.joints.armL.rotation.z = 1.5; ped.joints.armR.rotation.z = -1.35;
  ped.joints.elbowL.rotation.x = -0.4; ped.joints.elbowR.rotation.x = -0.5;
  ped.joints.legL.rotation.x = 0.25; ped.joints.legR.rotation.x = -0.35;
  ped.joints.kneeR.rotation.x = 0.9;
  ped.group.rotation.z = Math.PI / 2; // lying on the back
  ped.group.rotation.y = 0.6;
  ped.group.position.y = 0.16;
  g.add(ped.group);
  // Red ring marking the body.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.07, 10, 40),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.85 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);
  // Small blood-red pool (dark, stylised).
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20),
    new THREE.MeshStandardMaterial({ color: 0x8a1010, roughness: 0.4 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0.5, 0.04, 0.2);
  g.add(pool);
  return g;
}

// Spawn a wandering crowd on sidewalks + beach. Returns array of ped records.
export function spawnCrowd(scene, count, area) {
  const rng = mulberry32(4242);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const ped = makePed(rng);
    let x, z;
    const zone = rng();
    if (zone < 0.55) { // west sidewalk / market plaza
      x = rand(rng, -26, -9); z = rand(rng, area.z0, area.z1);
    } else if (zone < 0.8) { // east sidewalk / beach
      x = rand(rng, 13, 40); z = rand(rng, area.z0, area.z1);
    } else { // cross-street sidewalks
      x = rand(rng, -60, 8); z = pick(rng, [-80, 0, 80]) + rand(rng, -5, 5);
    }
    ped.group.position.set(x, 0, z);
    ped.group.rotation.y = rng() * TAU;
    ped.userData = { ...ped.userData, dir: rng() * TAU, wanderT: rand(rng, 2, 6), baseX: x, baseZ: z };
    scene.add(ped.group);
    peds.push(ped);
  }
  return peds;
}

export function updateCrowd(peds, dt, t, wanted) {
  for (const ped of peds) {
    const u = ped.userData;
    u.wanderT -= dt;
    if (u.wanderT <= 0) {
      u.dir = Math.random() * TAU;
      u.wanderT = 2 + Math.random() * 5;
    }
    const speed = wanted >= 4 ? 2.6 : 1.1; // crowd scatters when the heat is on
    const nx = ped.group.position.x + Math.sin(u.dir) * speed * dt * 0.4;
    const nz = ped.group.position.z + Math.cos(u.dir) * speed * dt * 0.4;
    // Keep peds on walkable ground: not on the road centre, not in the ocean.
    if (nx > -30 && nx < 42 && nz > -170 && nz < 170 && Math.abs(nx) > 7.6) {
      ped.group.position.x = nx;
      ped.group.position.z = nz;
      ped.group.rotation.y = u.dir;
      animatePed(ped, dt, true);
    } else {
      u.dir += Math.PI / 2;
    }
  }
}
