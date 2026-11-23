// city.js — Solara Bay itself: Strand Boulevard, 8 districts, beach + ocean,
// Kumala Pier, the Ferris wheel, the marina yacht, Pasaru night-market stalls,
// palms with curved drooping fronds, neon and street props.
// Layout: the boulevard runs north (-Z) to south (+Z) at x=0; the beach and
// ocean lie east (+X), the city blocks west (-X). The pier is at the north end.
import * as THREE from 'three';
import { mulberry32, rand, pick, TAU } from './utils.js';
import { facadeTexture, roadTexture, sandTexture, waterTexture, foamTexture, signTexture, awningTexture, neonTexture } from './textures.js';

const MAT = {};
function std(color, rough = 0.85, metal = 0.0) {
  const key = color + '/' + rough + '/' + metal;
  if (!MAT[key]) MAT[key] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: false });
  return MAT[key];
}

export const DISTRICTS = [
  { name: 'KUMALA STRAND', sub: 'Strand Boulevard', friendly: 58, x: 0, z: 60 },
  { name: 'PASARU MARKET', sub: 'Lantern Market', friendly: 74, x: -22, z: 30 },
  { name: 'MARINA DEL SOL', sub: 'Kumala Pier', friendly: 41, x: 30, z: -140 },
  { name: 'DOWNTOWN', sub: 'Bay Towers', friendly: 33, x: -60, z: -60 },
  { name: 'BRISA SOUND', sub: 'Tarpon Bridge', friendly: 62, x: -40, z: -150 },
  { name: 'PUERTO VIEJO', sub: 'Old Town', friendly: 47, x: -70, z: 40 },
  { name: 'MALECON CELESTE', sub: 'Golden Mile', friendly: 66, x: 0, z: -60 },
  { name: 'ALTO VISTA', sub: 'Hillside', friendly: 29, x: -90, z: 120 },
];

// ---- palms: curved trunk + drooping curved fronds (never angular triangles) --
function makePalm(rng) {
  const palm = new THREE.Group();
  const h = 6.5 + rng() * 3.5;
  const trunkMat = std(0x8a6a48, 0.95);
  // Trunk in 3 slightly-offset segments so it curves gently.
  let x = 0, z = 0;
  const segH = h / 3;
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - i * 0.03, 0.22 - i * 0.03, segH + 0.15, 10), trunkMat);
    x += (rng() - 0.5) * 0.35; z += (rng() - 0.5) * 0.35;
    seg.position.set(x, segH * (i + 0.5), z);
    seg.rotation.z = (rng() - 0.5) * 0.12;
    seg.castShadow = true;
    palm.add(seg);
  }
  const top = new THREE.Vector3(x, h, z);
  // Fronds: bent planes — each droops along its length, wide and soft.
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f9e4d, roughness: 0.9, side: THREE.DoubleSide, flatShading: false });
  const frondMat2 = new THREE.MeshStandardMaterial({ color: 0x57b25e, roughness: 0.9, side: THREE.DoubleSide, flatShading: false });
  const nFronds = 8 + Math.floor(rng() * 3);
  for (let i = 0; i < nFronds; i++) {
    const len = 2.6 + rng() * 1.1;
    const geo = new THREE.PlaneGeometry(len, 0.85, 7, 1);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const px = pos.getX(v);
      // Clamp: float error can push t a hair below 0, and Math.pow(neg, 2.2) is NaN.
      const t = Math.max(0, Math.min(1, (px + len / 2) / len)); // 0 at base, 1 at tip
      pos.setZ(v, -Math.pow(t, 2.2) * 1.5); // droop curve
      pos.setY(v, pos.getY(v) * (1 - t * 0.45)); // taper toward the tip
    }
    geo.computeVertexNormals();
    const frond = new THREE.Mesh(geo, i % 2 ? frondMat : frondMat2);
    frond.position.copy(top);
    frond.rotation.y = (i / nFronds) * TAU + rng() * 0.3;
    frond.rotation.x = -0.35 - rng() * 0.25;
    frond.castShadow = true;
    palm.add(frond);
  }
  // Coconut cluster.
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), std(0x6b4a26, 0.9));
  nuts.position.set(top.x, top.y - 0.25, top.z);
  palm.add(nuts);
  return palm;
}

// ---- Ferris wheel ------------------------------------------------------------
// The wheel faces south (+Z, toward the boulevard camera). Its plane is the
// XY plane, so rotation.y stays near 0 — a wheel turned edge-on reads as a
// thin mast, which is exactly the v13 cover failure.
function makeFerrisWheel(R = 28) {
  const wheel = new THREE.Group();
  const rimMat = std(0xf5f2ea, 0.5, 0.15);
  const accent = std(0xffb02e, 0.5);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.6, 12, 56), rimMat);
  rim.castShadow = true;
  wheel.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.79, 0.42, 10, 48), rimMat);
  wheel.add(rim2);
  // Spokes: 6 diameters (12 spokes) across the wheel plane.
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, R * 2, 8), rimMat);
    spoke.rotation.z = (i / 6) * Math.PI;
    wheel.add(spoke);
  }
  // Gondolas at the rim, kept upright by the update loop.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const gondola = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.1, 2.1), i % 2 ? std(0xff6b6b, 0.6) : std(0x39c6ff, 0.6));
    cab.castShadow = true;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.7, 8), rimMat);
    arm.position.y = 1.7;
    gondola.add(cab); gondola.add(arm);
    gondola.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    wheel.add(gondola);
    wheel.userData['gondola' + i] = gondola;
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 2.6, 24), accent);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  // A-frame legs: long enough to reach the ground from the hub.
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.05, R + 6, 10), std(0xd8d2c4, 0.6));
    leg.position.set(s * (R * 0.29), -(R / 2 + 2), 0);
    leg.rotation.z = s * 0.24;
    leg.castShadow = true;
    wheel.add(leg);
  }
  return wheel;
}

// ---- yacht: big white hull + dark window band + tall white sail --------------
export function makeYacht() {
  const yacht = new THREE.Group();
  // Hull: extruded side profile with a bevel — rounded, not a slab.
  const s = new THREE.Shape();
  s.moveTo(-11, 0); s.lineTo(11, 0); s.lineTo(9.5, 2.2); s.lineTo(7, 3.0);
  s.lineTo(-8, 3.0); s.lineTo(-10.5, 1.6); s.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(s, { depth: 5.4, bevelEnabled: true, bevelThickness: 0.7, bevelSize: 0.7, bevelSegments: 3, steps: 1 });
  hullGeo.translate(0, 0, -2.7);
  const hull = new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({ color: 0xf7f5ef, roughness: 0.35, metalness: 0.1, flatShading: false }));
  hull.castShadow = true;
  yacht.add(hull);
  // Dark window band along the hull.
  const band = new THREE.Mesh(new THREE.BoxGeometry(16.5, 0.9, 5.6), std(0x14202e, 0.25, 0.4));
  band.position.set(0, 2.1, 0);
  yacht.add(band);
  // Deck + cabin.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(15, 0.5, 4.6), std(0xd9c9a8, 0.8));
  deck.position.set(0, 3.4, 0);
  yacht.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(7, 1.8, 3.6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, flatShading: false }));
  cabin.position.set(-1, 4.5, 0);
  cabin.castShadow = true;
  yacht.add(cabin);
  // Tall mast + big white sail (slightly curved plane).
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 17, 10), std(0xcfc8b8, 0.5));
  mast.position.set(1.5, 11, 0);
  yacht.add(mast);
  const sailGeo = new THREE.PlaneGeometry(9, 15, 6, 4);
  const sp = sailGeo.attributes.position;
  for (let v = 0; v < sp.count; v++) {
    const px = sp.getX(v);
    sp.setZ(v, Math.sin((px + 4.5) / 9 * Math.PI) * 1.1); // belly curve
  }
  sailGeo.computeVertexNormals();
  // The sail is a big vertical white surface under a high noon sun: vertical
  // faces get little direct sun, so a touch of emissive keeps it reading
  // white instead of grey from the road.
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide, flatShading: false, emissive: 0x8a8a8a, emissiveIntensity: 0.45 });
  const sail = new THREE.Mesh(sailGeo, sailMat);
  sail.position.set(6.2, 11.5, 0);
  sail.castShadow = true;
  yacht.add(sail);
  const sail2 = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 9, 4, 3), new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.6, side: THREE.DoubleSide, flatShading: false, emissive: 0x777777, emissiveIntensity: 0.35 }));
  sail2.position.set(-1.4, 9.5, 0);
  sail2.rotation.y = 0.35;
  yacht.add(sail2);
  return yacht;
}

// ---- market stall ------------------------------------------------------------
function makeStall(rng, signText, signBg, signFg, awningA, awningB) {
  const stall = new THREE.Group();
  const counter = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 2.0), std(0x7a5230, 0.85));
  counter.position.y = 0.55; counter.castShadow = true; counter.receiveShadow = true;
  stall.add(counter);
  // Goods: colourful crates + fruit piles.
  const goodsCols = [0xff5a3c, 0xffc93c, 0x7ddc4f, 0xff8fb3, 0xc98aff];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), std(pick(rng, goodsCols), 0.7));
    g.position.set(-1.7 + (i % 3) * 0.85, 1.3, (i < 3 ? -0.45 : 0.45));
    g.castShadow = true;
    stall.add(g);
  }
  for (let i = 0; i < 4; i++) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), std(0x5a4632, 0.8));
    pole.position.set(i % 2 ? 2.0 : -2.0, 1.3, i < 2 ? -0.9 : 0.9);
    stall.add(pole);
  }
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.6),
    new THREE.MeshStandardMaterial({ map: awningTexture(Math.floor(rng() * 1e9), awningA, awningB), roughness: 0.85, side: THREE.DoubleSide, flatShading: false }));
  awn.rotation.x = -Math.PI / 2 + 0.32;
  awn.position.y = 2.7;
  awn.castShadow = true;
  stall.add(awn);
  // Sign board — plain, unobstructed, facing the road (east).
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7),
    new THREE.MeshStandardMaterial({ map: signTexture(signText, signBg, signFg), roughness: 0.7, flatShading: false }));
  sign.position.set(0, 3.6, 0);
  stall.add(sign);
  return stall;
}

// ---- main city build ---------------------------------------------------------
export function buildCity(scene) {
  const rng = mulberry32(15081986);
  const handles = { ferris: null, yacht: null, palms: [], stalls: [], update: null };

  // Ground base.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), std(0x77806a, 0.95));
  ground.rotation.x = -Math.PI / 2; ground.position.set(-40, -0.05, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // Beach sand (east) + ocean (further east).
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(34, 380), new THREE.MeshStandardMaterial({ map: sandTexture(41), roughness: 0.95, flatShading: false }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(29, 0.02, 0);
  sand.receiveShadow = true;
  scene.add(sand);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(320, 560), new THREE.MeshStandardMaterial({ map: waterTexture(7), roughness: 0.35, metalness: 0.1, flatShading: false }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(206, 0.0, 0);
  ocean.receiveShadow = true;
  scene.add(ocean);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(3, 380), new THREE.MeshBasicMaterial({ map: foamTexture(), transparent: true, opacity: 0.75, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(45.5, 0.06, 0);
  scene.add(foam);

  // Strand Boulevard road (north-south) + cross streets.
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(11), roughness: 0.9, flatShading: false });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(15, 360), roadMat);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.04, 0);
  road.receiveShadow = true;
  scene.add(road);
  for (const z of [-80, 0, 80]) {
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(120, 11), roadMat);
    cross.rotation.x = -Math.PI / 2; cross.rotation.z = Math.PI / 2;
    cross.position.set(-58, 0.04, z);
    cross.receiveShadow = true;
    scene.add(cross);
  }
  // Sidewalks.
  const walkMat = std(0xb9b3a6, 0.95);
  for (const x of [-10.5, 10.5]) {
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 360), walkMat);
    walk.rotation.x = -Math.PI / 2; walk.position.set(x, 0.03, 0);
    walk.receiveShadow = true;
    scene.add(walk);
  }

  // ---- buildings: west blocks + a few east-side towers -----------------------
  const facadeMats = [];
  for (let i = 0; i < 6; i++) {
    facadeMats.push(new THREE.MeshStandardMaterial({ map: facadeTexture(1000 + i * 137), roughness: 0.85, flatShading: false }));
  }
  const roofMat = std(0x6e6a62, 0.95);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function building(x, z, w, d, h, matIdx, rotY = 0) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(boxGeo, facadeMats[matIdx % facadeMats.length]);
    body.scale.set(w, h, d);
    body.position.y = h / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    // Parapet + roof props.
    const par = new THREE.Mesh(boxGeo, roofMat);
    par.scale.set(w + 0.3, 0.7, d + 0.3); par.position.y = h + 0.35;
    g.add(par);
    if (rng() > 0.4) {
      const ac = new THREE.Mesh(boxGeo, std(0x9aa2ac, 0.7, 0.3));
      ac.scale.set(2.2, 1.0, 1.6); ac.position.set(rand(rng, -w / 4, w / 4), h + 1.1, rand(rng, -d / 4, d / 4));
      ac.castShadow = true;
      g.add(ac);
    }
    if (rng() > 0.6) {
      const tower = new THREE.Group();
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.4, 14), std(0x8a6a48, 0.9));
      tank.position.y = 1.8; tank.castShadow = true;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.1, 14), std(0x5e4630, 0.9));
      cone.position.y = 3.5;
      tower.add(tank); tower.add(cone);
      tower.position.set(rand(rng, -w / 4, w / 4), h + 0.7, rand(rng, -d / 4, d / 4));
      g.add(tower);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    return g;
  }
  // West row 1 (boulevard frontage).
  const westRow = [
    [-24, -150, 18, 16, 34], [-24, -118, 16, 15, 22], [-24, -88, 18, 16, 44],
    [-24, -56, 15, 14, 18], [-24, -26, 18, 16, 30], [-24, 6, 16, 15, 52],
    [-24, 38, 18, 16, 26], [-24, 70, 16, 15, 36], [-24, 102, 18, 16, 24],
    [-24, 134, 16, 15, 30], [-24, 162, 18, 16, 20],
  ];
  westRow.forEach(([x, z, w, d, h], i) => building(x, z, w, d, h, i));
  // West row 2 (taller downtown towers).
  const westRow2 = [
    [-52, -140, 22, 20, 58], [-52, -100, 20, 18, 42], [-52, -60, 24, 20, 66],
    [-52, -16, 20, 18, 38], [-52, 28, 22, 20, 48], [-52, 72, 20, 18, 62],
    [-52, 116, 22, 20, 40], [-52, 152, 20, 18, 54],
  ];
  westRow2.forEach(([x, z, w, d, h], i) => building(x, z, w, d, h, i + 3));
  // Far west blocks.
  for (let i = 0; i < 8; i++) {
    building(-84 - rng() * 20, -150 + i * 44 + rand(rng, -6, 6), 20 + rng() * 8, 18 + rng() * 6, 20 + rng() * 34, i + 1);
  }
  // Marina towers on the north-east (behind the pier road).
  building(24, -168, 16, 14, 30, 2);
  building(-20, -178, 18, 16, 40, 4);

  // BAY billboard on the boulevard frontage building + neon.
  const bill = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5),
    new THREE.MeshStandardMaterial({ map: signTexture('BAY', '#ff2e63', '#ffffff', 'OPEN NOW'), roughness: 0.6, emissive: 0x661122, emissiveIntensity: 0.4, flatShading: false }));
  bill.position.set(-14.8, 26, -56); bill.rotation.y = Math.PI / 2;
  scene.add(bill);
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4),
    new THREE.MeshBasicMaterial({ map: neonTexture('SOLARA', '#39c6ff'), transparent: true, fog: false }));
  neon.position.set(-14.8, 14, 6); neon.rotation.y = Math.PI / 2;
  scene.add(neon);

  // ---- palms along both sidewalks + beach edge -------------------------------
  for (let z = -160; z <= 160; z += 16) {
    if (Math.abs(z - 30) < 10) continue; // keep the market frontage clear
    const p1 = makePalm(rng); p1.position.set(-9.2, 0, z + rand(rng, -2, 2)); scene.add(p1); handles.palms.push(p1);
    const p2 = makePalm(rng); p2.position.set(11.8, 0, z + 8 + rand(rng, -2, 2)); scene.add(p2); handles.palms.push(p2);
  }
  // Beach palms, taller, near the sand.
  for (let z = -140; z <= 140; z += 26) {
    const p = makePalm(rng); p.scale.setScalar(1.25); p.position.set(20 + rand(rng, -2, 3), 0, z); scene.add(p); handles.palms.push(p);
  }

  // ---- beach umbrellas + towels ----------------------------------------------
  const umbCols = [0xff5a3c, 0x39c6ff, 0xffc93c, 0x7ddc4f, 0xff8fb3];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), std(0xe8e0cc, 0.7));
    pole.position.y = 1.2;
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.0, 12, 1, true), new THREE.MeshStandardMaterial({ color: pick(rng, umbCols), roughness: 0.8, side: THREE.DoubleSide, flatShading: false }));
    top.position.y = 2.6;
    top.castShadow = true;
    g.add(pole); g.add(top);
    g.position.set(rand(rng, 16, 40), 0, rand(rng, -150, 150));
    scene.add(g);
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), std(pick(rng, umbCols), 0.9));
    towel.rotation.x = -Math.PI / 2; towel.rotation.z = rng() * TAU;
    towel.position.set(g.position.x + rand(rng, -2, 2), 0.05, g.position.z + rand(rng, -2, 2));
    scene.add(towel);
  }

  // ---- Kumala Pier (north end, into the ocean) -------------------------------
  const pier = new THREE.Group();
  const deckMat = std(0x9a7a52, 0.9);
  for (let x = 12; x <= 62; x += 2.2) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.28, 7), deckMat);
    plank.position.set(x, 0.9, -150);
    plank.castShadow = true; plank.receiveShadow = true;
    pier.add(plank);
  }
  for (let x = 14; x <= 62; x += 8) {
    for (const dz of [-3.2, 3.2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 8), std(0x6b4a26, 0.9));
      post.position.set(x, 0.1, -150 + dz);
      pier.add(post);
    }
  }
  // Pier lamps.
  for (let x = 18; x <= 58; x += 10) {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 8), std(0x2a2f38, 0.6, 0.4));
    pole.position.y = 1.7;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf8a, emissiveIntensity: 1.4 }));
    bulb.position.y = 3.5;
    lamp.add(pole); lamp.add(bulb);
    lamp.position.set(x, 0.9, -152.6);
    pier.add(lamp);
  }
  // Pier end hut.
  const hut = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 4.5), std(0xe8dcc0, 0.85));
  hut.position.set(60, 2.6, -150); hut.castShadow = true;
  pier.add(hut);
  const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.6, 4), std(0xff5a3c, 0.8));
  hutRoof.position.set(60, 5.0, -150); hutRoof.rotation.y = Math.PI / 4;
  pier.add(hutRoof);
  scene.add(pier);

  // ---- Ferris wheel (pier base, huge, fully visible from the boulevard) ------
  // R=28, hub at y=33 so the rim bottom clears the sand and the legs stand on it.
  const ferris = makeFerrisWheel(28);
  ferris.position.set(26, 33, -102);
  ferris.rotation.y = 0.12;
  scene.add(ferris);
  handles.ferris = ferris;

  // ---- yacht + distant sailboat ----------------------------------------------
  // Anchored close off the beach so the hull + tall sail read BIG from the road.
  const yacht = makeYacht();
  yacht.position.set(54, 0.1, -38);
  // Sail faces south, slightly east: it catches the noon sun AND faces the
  // boulevard camera, so the white sail reads bright from the road.
  yacht.rotation.y = -0.2;
  scene.add(yacht);
  handles.yacht = yacht;
  const boat2 = makeYacht();
  boat2.scale.setScalar(0.55);
  boat2.position.set(120, 0.1, 30);
  boat2.rotation.y = 0.7;
  scene.add(boat2);

  // ---- Pasaru Market stalls (west plaza, signs facing the road) -------------
  const stallDefs = [
    { z: 14, text: 'JUICE', bg: '#ff8c1a', fg: '#ffffff', a: '#ff8c1a', b: '#fff3d6' },
    { z: 22, text: 'SPICE', bg: '#c0392b', fg: '#ffe9a8', a: '#c0392b', b: '#ffe9a8' },
    { z: 30, text: 'FRUIT', bg: '#ff2e88', fg: '#ffffff', a: '#ff2e88', b: '#ffffff' },
    { z: 38, text: 'FISH', bg: '#1a7fbf', fg: '#ffffff', a: '#1a7fbf', b: '#d6f2ff' },
    { z: 46, text: 'FLOWER', bg: '#7d4fc4', fg: '#ffffff', a: '#7d4fc4', b: '#f2e6ff' },
  ];
  for (const d of stallDefs) {
    const stall = makeStall(rng, d.text, d.bg, d.fg, d.a, d.b);
    // Stalls sit ON the west sidewalk (x=-13), in the open with the buildings
    // behind them — never squeezed against a building face.
    stall.position.set(-13, 0, d.z);
    stall.rotation.y = Math.PI / 2; // face east, toward the road + camera
    scene.add(stall);
    handles.stalls.push(stall);
  }
  // Market string lights between two poles.
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc93c, emissiveIntensity: 1.2 });
  for (let i = 0; i < 9; i++) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), bulbMat);
    bulb.position.set(-17, 5.2 - Math.sin((i / 8) * Math.PI) * 0.7, 12 + i * 4.2);
    scene.add(bulb);
  }

  // ---- street lamps along the boulevard ---------------------------------------
  const lampPoleMat = std(0x2a2f38, 0.6, 0.4);
  for (let z = -150; z <= 150; z += 30) {
    for (const x of [-8.6, 8.6]) {
      // No west lamp at the market frontage (z=30): it would stand in the
      // middle of the foot-shot sightline to the FRUIT stall.
      if (x < 0 && Math.abs(z - 30) < 8) continue;
      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 5.2, 8), lampPoleMat);
      pole.position.y = 2.6; pole.castShadow = true;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), lampPoleMat);
      arm.rotation.z = Math.PI / 2; arm.position.set(x < 0 ? 0.7 : -0.7, 5.1, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf8a, emissiveIntensity: 0.9 }));
      head.position.set(x < 0 ? 1.4 : -1.4, 5.0, 0);
      lamp.add(pole); lamp.add(arm); lamp.add(head);
      lamp.position.set(x, 0, z);
      scene.add(lamp);
    }
  }

  // Traffic lights at the cross streets.
  for (const z of [-80, 0, 80]) {
    const tl = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.6, 8), lampPoleMat);
    pole.position.y = 2.8;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), std(0x1c1f26, 0.6));
    box.position.set(0, 5.4, 0);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshStandardMaterial({ color: 0x37e08b, emissive: 0x37e08b, emissiveIntensity: 1.6 }));
    light.position.set(0, 5.75, 0.28);
    tl.add(pole); tl.add(box); tl.add(light);
    tl.position.set(7.6, 0, z + 6);
    scene.add(tl);
  }

  handles.update = (dt, t) => {
    // Ferris wheel turns slowly; gondolas stay upright.
    ferris.rotation.z += dt * 0.05;
    for (let i = 0; i < 12; i++) {
      const g = ferris.userData['gondola' + i];
      if (g) g.rotation.z = -ferris.rotation.z;
    }
    // Yacht bobs gently.
    yacht.position.y = 0.1 + Math.sin(t * 0.7) * 0.25;
    yacht.rotation.z = Math.sin(t * 0.5) * 0.012;
    boat2.position.y = 0.1 + Math.sin(t * 0.6 + 2) * 0.2;
  };
  return handles;
}
