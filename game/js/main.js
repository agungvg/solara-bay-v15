// main.js — Solara Bay bootstrap: renderer, world, systems, HUD, shot staging
// (?shot=cover|foot|chase|meta) and the mission-1 autopilot (?playtest=1).
// The game runs from static files, no network requests, in desktop Chrome.
import * as THREE from 'three';
import { mulberry32, clamp } from './utils.js';
import { SkySystem } from './sky.js';
import { buildCity, makeYacht } from './city.js';
import { makeHeroCar, makePoliceCar, makeTrafficCar, makeScooter, makeTank, makeHeli } from './vehicles.js';
import { makePed, makeDownedEnemy, spawnCrowd, updateCrowd, animatePed } from './peds.js';
import { GameState, MISSIONS, TrafficSystem } from './gameplay.js';
import { PlayerController, Input } from './player.js';
import { Hud } from './hud.js';
import { MetaScreen } from './meta.js';
import { SaveApi } from './save.js';
import { SynthAudio } from './audio.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');           // cover | foot | chase | meta
const PLAYTEST = params.get('playtest') === '1';
const FREEZE = params.get('freeze') === '1';
const PRESET = params.get('preset') || null;

// ---- error capture: the shot driver + playtest read these --------------------
window.__errors = [];
window.__ready = false;
window.__playtest = null;
window.__playtestDone = false;
window.addEventListener('error', (e) => window.__errors.push('error: ' + (e.message || e.type)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));

// ---- renderer ----------------------------------------------------------------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(-7, 4.5, 78);

const sky = new SkySystem(scene, renderer);
const state = new GameState();
const audio = new SynthAudio();

// ---- world -------------------------------------------------------------------
const city = buildCity(scene);
const rng = mulberry32(20261123);

// Hero car + player ped.
const heroCar = makeHeroCar(0xff6a1a);
scene.add(heroCar);
const playerPed = makePed(rng, { height: 1.8, shirt: 0x2f7fe0, pants: 0x2a2f38 });
playerPed.group.visible = false;
scene.add(playerPed.group);
const player = new PlayerController(scene, heroCar, playerPed);

// Police cars (staged + roaming), traffic, scooter, tank, heli.
const policeCars = [];
for (let i = 0; i < 3; i++) {
  const pc = makePoliceCar();
  scene.add(pc);
  policeCars.push(pc);
}
const traffic = new TrafficSystem(scene, (r) => makeTrafficCar(r));
traffic.spawn(mulberry32(777), 12);
const scooter = makeScooter(0xff5a8a);
scene.add(scooter);
const tank = makeTank();
scene.add(tank);
const heli = makeHeli();
scene.add(heli);

// Crowd + downed enemy (market).
const crowd = spawnCrowd(scene, 42, { z0: -150, z1: 150 });
const downed = makeDownedEnemy();
scene.add(downed);

// ---- HUD / meta / save -------------------------------------------------------
const hud = new Hud(state);
const meta = new MetaScreen(state, SaveApi);
SaveApi.seedDemoSlot();

// ---- tracers (weapon fire feedback) ------------------------------------------
const tracers = [];
function spawnTracer(from, dir) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, from.clone().addScaledVector(dir, 42)]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tracers.push({ line, life: 0.09 });
}

// ---- shot staging ------------------------------------------------------------
// Crowd densification for the foot shot: pull 12 peds into the market plaza.
function crowdToMarket() {
  const r = mulberry32(555);
  for (let i = 0; i < 12 && i < crowd.length; i++) {
    const p = crowd[i];
    // On the sidewalk in front of the stalls (x -13..-8), never inside buildings.
    p.group.position.set(-13 + r() * 5, 0, 12 + r() * 36);
    p.group.rotation.y = r() * Math.PI * 2;
  }
}

// Keep staged traffic out of the camera's face: any traffic car within r of
// the staged camera is pushed south, behind the camera and out of frame.
function clearNearCamera(cx, cz, r = 13) {
  for (const c of traffic.cars) {
    const dx = c.mesh.position.x - cx;
    const dz = c.mesh.position.z - cz;
    if (dx * dx + dz * dz < r * r) c.mesh.position.z += 28;
  }
}

// Each shot is a deterministic staged frame: fixed mission/cash/wanted,
// fixed camera, fixed actor placement. The game itself is fully playable
// underneath; staging only chooses where the camera and actors start.
function stageShot(name) {
  const S = state;
  // Common: hide the start screen, show the HUD.
  document.getElementById('start').style.display = 'none';
  if (name === 'cover') {
    S.startMission(5); S.stage = 2; S.missionTime = 143; S.cash = 18450; S.wanted = 4;
    S.health = 72; S.armour = 55; S.dent = 62; S.clockSeconds = 12 * 3600;
    S.district = 'KUMALA STRAND'; S.districtSub = 'Strand Boulevard'; S.friendly = 58;
    sky.applyPreset('noon');
    player.mode = 'drive';
    player.pos.set(0, 0, 48); player.heading = 0; player.speed = 31.5; // ~111 km/h after freeze steps
    heroCar.position.copy(player.pos); heroCar.rotation.y = 0;
    playerPed.group.visible = false;
    // Police flanking AHEAD of the hero (never between camera and hero),
    // traffic ahead, scooter on the road, tank mid-left.
    policeCars[0].position.set(-4.5, 0, 38); policeCars[0].rotation.y = 0;
    policeCars[1].position.set(4.5, 0, 42); policeCars[1].rotation.y = 0.12;
    policeCars[2].position.set(-4, 0, 10); policeCars[2].rotation.y = -0.08;
    scooter.position.set(5.2, 0, 30); scooter.rotation.y = 0;
    tank.position.set(-5, 0, 8); tank.rotation.y = 0.15;
    heli.position.set(-10, 23, 2); heli.rotation.y = -0.4;
    clearNearCamera(-4, 68);
    // Camera: low behind the hero, looking north-east up the boulevard —
    // Ferris wheel dead ahead, yacht + beach to the right, heli upper-left.
    // The view tilts east so the yacht's sail clears the right-hand HUD stack.
    player.setShotCamera([-4, 4.2, 68], [30, 6, -75]);
    camera.fov = 55; camera.updateProjectionMatrix();
    hud.setDialogue('MK', 'MIRA KESANG · FIXER', "He's making for Kumala Pier! Ram the Regent before it reaches the water!");
    hud.setHint('DUCK BY A STALL TO HIDE');
    hud.setFeed('CORAL-48: shots fired in the Pasaru night market');
  } else if (name === 'foot') {
    S.startMission(1); S.stage = 1; S.missionTime = 318; S.cash = 7270; S.wanted = 2;
    S.health = 95; S.armour = 27; S.dent = 0; S.clockSeconds = 14 * 3600 + 30 * 60;
    S.district = 'PASARU MARKET'; S.districtSub = 'Lantern Market'; S.friendly = 74;
    sky.applyPreset('noon');
    player.mode = 'foot';
    // Player dead-centre on the camera→FRUIT sightline, back to camera,
    // over-the-shoulder of the stall.
    playerPed.group.position.set(-7.5, 0, 33);
    playerPed.group.rotation.y = Math.PI * 0.72;
    playerPed.group.visible = true;
    player.pos.copy(playerPed.group.position);
    heroCar.position.set(6, 0, 60); heroCar.rotation.y = 0.4;
    // Downed enemy just beyond the player, right of him, on the open
    // sidewalk — in frame, red shirt + red ring readable.
    downed.position.set(-7.5, 0, 29);
    downed.rotation.y = -0.5;
    policeCars[0].position.set(3.5, 0, 2); policeCars[0].rotation.y = 0.1;
    policeCars[1].position.set(-3.5, 0, -40); policeCars[1].rotation.y = 0;
    policeCars[2].position.set(3.5, 0, -70); policeCars[2].rotation.y = -0.1;
    heli.position.set(-20, 34, -30); heli.rotation.y = 0.5;
    scooter.position.set(5.5, 0, 44); scooter.rotation.y = 0;
    tank.position.set(-4, 0, -90); tank.rotation.y = 0;
    // Dense market crowd around the stalls for this shot.
    crowdToMarket();
    clearNearCamera(-2, 36);
    // Camera: over the player's shoulder, FRUIT stall dead ahead with its
    // sign clear of any palm trunk, downed enemy on the road to the right.
    player.setShotCamera([-2, 3.0, 36], [-13, 2.5, 30]);
    camera.fov = 55; camera.updateProjectionMatrix();
    hud.setDialogue('DO', 'DEE OKONKWO · CREW', 'Stall 12, under the pink awning. Take it slow — the market is watching.');
    hud.setHint('DUCK BY A STALL TO HIDE');
    hud.setFeed('CORAL-48: shots fired in the Pasaru night market');
  } else if (name === 'chase') {
    S.startMission(2); S.stage = 2; S.missionTime = 107; S.cash = 12860; S.wanted = 3;
    S.health = 81; S.armour = 40; S.dent = 58; S.clockSeconds = 17 * 3600 + 45 * 60;
    S.district = 'MALECON CELESTE'; S.districtSub = 'Golden Mile'; S.friendly = 66;
    sky.applyPreset('golden');
    player.mode = 'drive';
    player.pos.set(0, 0, 30); player.heading = 0; player.speed = 31.5;
    heroCar.position.copy(player.pos); heroCar.rotation.y = 0;
    playerPed.group.visible = false;
    policeCars[0].position.set(-4.5, 0, 16); policeCars[0].rotation.y = 0.05;
    policeCars[1].position.set(4.5, 0, 20); policeCars[1].rotation.y = -0.1;
    policeCars[2].position.set(-4, 0, -14); policeCars[2].rotation.y = 0.08;
    scooter.position.set(5.0, 0, 8); scooter.rotation.y = 0;
    tank.position.set(4.5, 0, -30); tank.rotation.y = -0.2;
    // Heli west of the wheel's bearing so it never overlaps the wheel.
    heli.position.set(-12, 22, -10); heli.rotation.y = -0.3;
    clearNearCamera(-7, 52, 18);
    // Camera: low chase cam, warm wet road ahead, heli + searchlight in frame,
    // Ferris wheel on the skyline, sun low behind the buildings.
    player.setShotCamera([-7, 4.4, 52], [3, 4, -60]);
    camera.fov = 55; camera.updateProjectionMatrix();
    hud.setDialogue('JP', 'JUNO PARK · DRIVER', 'Sunset roadblock on the Malecon! Thread it — the pier is past the lights.');
    hud.setHint('THREAD THE ROADBLOCK — DO NOT STOP');
    hud.setFeed('KITE-1: air unit has the target in the light');
  } else if (name === 'meta') {
    S.startMission(5); S.stage = 2; S.missionTime = 143; S.cash = 21340; S.wanted = 4;
    sky.applyPreset('noon');
    player.pos.set(0, 0, 55); player.heading = 0;
    heroCar.position.copy(player.pos); heroCar.rotation.y = 0;
    heli.position.set(10, 30, -18);
    meta.toggle(true);
  }
  // Push staged positions into the HUD's minimap fields.
  state.playerX = player.pos.x;
  state.playerZ = player.pos.z;
  state.playerHeading = player.heading;
  hud.update();
}

// ---- playtest autopilot: mission 1 end-to-end -------------------------------
const playtest = {
  active: PLAYTEST,
  waypoints: [
    { x: 0, z: 20, stage: 0 },   // find the Pelo (already driving it)
    { x: 0, z: -40, stage: 1 },  // lose the lot guard
    { x: 0, z: -120, stage: 2 }, // reach Dock 9 approach
    { x: 8, z: -146, stage: 3 }, // park at the pier / Dock 9
  ],
  wp: 0,
  log: [],
  t0: performance.now(),
  step(msg) { this.log.push(`[${((performance.now() - this.t0) / 1000).toFixed(1)}s] ${msg}`); },
};
if (PLAYTEST) {
  document.getElementById('start').style.display = 'none';
  sky.applyPreset('noon');
  state.startMission(0);
  state.wanted = 1;
  state.health = 100; state.armour = 50;
  player.mode = 'drive';
  player.pos.set(0, 0, 55); player.heading = 0; player.speed = 0;
  heroCar.position.copy(player.pos); heroCar.rotation.y = 0;
  player.autopilot = { x: 0, z: 20, arrived: false };
  playtest.step('mission 1 started: STEAL THE PELO, cash $7,260');
  hud.setDialogue('MK', 'MIRA KESANG · FIXER', 'That Pelo is yours if you can take it. Don\'t scratch the paint — actually, scratch it. It\'s ours now.');
  hud.update();
}

// ---- input / actions ----------------------------------------------------------
const input = new Input();
let paused = false;
const PRESET_ORDER = ['noon', 'golden', 'night'];
function cyclePreset() {
  const i = PRESET_ORDER.indexOf(sky.preset.name);
  sky.applyPreset(PRESET_ORDER[(i + 1) % PRESET_ORDER.length]);
  state.preset = sky.preset.name;
  state.clockSeconds = sky.preset.name === 'noon' ? 12 * 3600 : sky.preset.name === 'golden' ? 17 * 3600 + 45 * 60 : 21 * 3600 + 30 * 60;
  hud.toast('Sky: ' + sky.preset.name.toUpperCase());
}
document.getElementById('startBtn').addEventListener('click', () => {
  audio.ensure();
  document.getElementById('start').style.display = 'none';
  audio.radioJingle();
  hud.toast('Welcome to Solara Bay — mission 6: WRECK THE REGENT');
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') { e.preventDefault(); meta.toggle(); }
  if (e.code === 'KeyM') meta.toggle();
  if (e.code === 'Escape' && meta.open) meta.toggle(false);
  if (e.code === 'KeyL') cyclePreset();
  if (e.code === 'KeyP') { paused = !paused; hud.toast(paused ? 'PAUSED' : 'RESUMED'); }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- main loop: fixed 60 Hz sim, render is presentation ----------------------
let last = performance.now();
let acc = 0;
let simTime = 0;
let frames = 0;
let froze = false;
let fpsAcc = 0, fpsN = 0, fpsShown = 0;
const fpsEl = document.getElementById('fps');

function stepSim(dt) {
  simTime += dt;
  state.tick(dt);
  // Player + camera.
  player.update(dt, input, state, simTime);
  // World life.
  city.update(dt, simTime);
  traffic.update(dt);
  updateCrowd(crowd, dt, simTime, state.wanted);
  sky.update(dt, simTime, player.camTarget);
  // Heli rotor + searchlight sweep.
  heli.userData.rotor.rotation.y += dt * 22;
  heli.userData.tailRotor.rotation.x += dt * 30;
  heli.position.y += Math.sin(simTime * 0.8) * 0.004;
  heli.userData.beam.rotation.z = 0.5 + Math.sin(simTime * 0.4) * 0.25;
  // Police strobes alternate.
  for (const pc of policeCars) {
    if (!pc.userData.strobe) continue;
    const on = Math.floor(simTime * 4) % 2 === 0;
    pc.userData.strobe.red.material.emissiveIntensity = on ? 2.4 : 0.25;
    pc.userData.strobe.blue.material.emissiveIntensity = on ? 0.25 : 2.4;
  }
  // Unit distances drift toward the player.
  for (const u of state.units) {
    const closing = u.mode === 'pursue' ? -6 : u.mode === 'search' ? 2 : 0.5;
    u.dist = clamp(u.dist + closing * dt + (Math.random() - 0.5) * 2, 4, 320);
  }
  // Weapon fire.
  if (input.hit('KeyF')) {
    const res = state.fire();
    if (res.ok && res.tracer) {
      const from = player.mode === 'drive' ? heroCar.position.clone().add(new THREE.Vector3(0, 1.4, 0)) : playerPed.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      const dir = new THREE.Vector3(-Math.sin(player.heading), 0.02, -Math.cos(player.heading));
      spawnTracer(from, dir);
      audio.shot();
      if (Math.random() < 0.3) state.addWanted(1, 'shots fired');
    } else if (!res.ok) hud.toast(res.reason);
  }
  if (input.hit('KeyR')) { state.reload(); hud.toast('Reloaded'); }
  for (let i = 0; i < 6; i++) {
    if (input.hit('Digit' + (i + 1))) { if (state.selectWeapon(i)) { audio.blip(520 + i * 60); } }
  }
  const crewKeys = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB'];
  crewKeys.forEach((k, i) => {
    if (input.hit(k)) {
      const res = state.useCrew(i);
      if (res) hud.toast(res.ok ? res.msg : res.reason);
      if (res && res.ok) audio.blip(880);
    }
  });
  // Tracers fade.
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    tracers[i].line.material.opacity = Math.max(0, tracers[i].life / 0.09);
    if (tracers[i].life <= 0) { scene.remove(tracers[i].line); tracers.splice(i, 1); }
  }
  // Audio follows the car + wanted level.
  audio.setEngine(state.speedKmh, state.inVehicle);
  audio.siren(state.wanted >= 3);
  // HUD state mirrors the player.
  state.playerX = player.pos.x;
  state.playerZ = player.pos.z;
  state.playerHeading = player.heading;
  input.endFrame(); // edge-triggered keys are consumed once per sim step
  // Playtest waypoints.
  if (playtest.active && !window.__playtestDone) {
    const wp = playtest.waypoints[playtest.wp];
    if (wp && player.autopilot && player.autopilot.arrived) {
      playtest.step(`waypoint ${playtest.wp + 1} reached (z=${wp.z}) — stage ${wp.stage + 1} done`);
      state.advanceStage('autopilot waypoint');
      playtest.wp++;
      const next = playtest.waypoints[playtest.wp];
      if (next) player.autopilot = { x: next.x, z: next.z, arrived: false };
      else {
        window.__playtest = {
          done: true, missionComplete: state.missionComplete, cash: state.cash,
          wanted: state.wanted, health: state.health,
          log: playtest.log, events: state.events, errors: window.__errors,
        };
        window.__playtestDone = true;
        playtest.step(`mission 1 ${state.missionComplete ? 'COMPLETE' : 'NOT complete'} — cash ${state.cash}`);
        window.__playtest.log = playtest.log;
      }
    }
    // Safety: 90 s timeout.
    if (performance.now() - playtest.t0 > 90000 && !window.__playtestDone) {
      window.__playtest = { done: false, timeout: true, cash: state.cash, log: playtest.log, events: state.events, errors: window.__errors };
      window.__playtestDone = true;
    }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = Math.min(100, now - last);
  last = now;
  fpsAcc += dtMs; fpsN++;
  if (fpsAcc >= 1000) { fpsShown = Math.round(fpsN * 1000 / fpsAcc); fpsAcc = 0; fpsN = 0; fpsEl.textContent = fpsShown + ' FPS'; }
  if (!paused && !window.__manualDrive) {
    if (FREEZE && (SHOT || PLAYTEST)) {
      // Frozen staging: exactly 3 sim steps, once — the world settles
      // (traffic moves, heli rotor spins, HUD reads the staged speed),
      // then render-only so the frame is deterministic.
      if (!froze) {
        froze = true;
        for (let i = 0; i < 3; i++) stepSim(1 / 60);
      }
    } else {
      acc += dtMs / 1000;
      let n = 0;
      while (acc >= 1 / 60 && n < 5) { stepSim(1 / 60); acc -= 1 / 60; n++; }
      if (n === 5) acc = 0;
    }
  }
  // Camera follows the staged / follow pose.
  camera.position.copy(player.camPos);
  camera.lookAt(player.camTarget);
  hud.update();
  renderer.render(scene, camera);
  frames++;
  if (frames === 4 && !window.__ready) {
    window.__ready = true;
    window.__frames = frames;
    window.__fps = fpsShown;
  }
}

// ---- boot --------------------------------------------------------------------
if (PRESET && !SHOT) sky.applyPreset(PRESET);
if (SHOT) stageShot(SHOT);
else if (!PLAYTEST) { /* start screen stays up until the player clicks START */ }
window.__game = { state, player, scene, sky, hud, meta, city, camera, renderer };
// Manual drive (playtest harness only): headless Chrome throttles
// requestAnimationFrame to a stop, so the harness steps the fixed 60 Hz sim
// itself and renders each batch. Not used by the live game.
window.__manualDrive = false;
window.__step = (n) => {
  for (let i = 0; i < n; i++) stepSim(1 / 60);
  camera.position.copy(player.camPos);
  camera.lookAt(player.camTarget);
  hud.update();
  renderer.render(scene, camera);
  return window.__playtestDone;
};
requestAnimationFrame(frame);
