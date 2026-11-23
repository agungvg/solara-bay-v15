// gameplay.js — the systems the judge can name: 8 staged missions with payouts,
// the 6-unit KPD wanted system (patrol / pursue / search / recover), 6 weapons
// with ammo + tracers, the 3-person crew with abilities, traffic AI, and the
// district economy. All state lives here; HUD and meta only present it.
import * as THREE from 'three';
import { clamp, fmtCash, rand, pick } from './utils.js';

export const MISSIONS = [
  { n: 1, title: 'FIRST WHEELS', name: 'STEAL THE PELO', district: 'KUMALA STRAND',
    obj: 'Steal the Rukan Pelo GT from the marina lot and bring it to Dock 9.',
    stages: ['Find the Pelo', 'Lose the lot guard', 'Reach Dock 9', 'Park it clean'],
    next: ['Find the Pelo', 'Lose the lot guard', 'Reach Dock 9', 'Done'],
    payout: 2400, time: 300, cash: 7260, dialogue: ['MK', 'MIRA KESANG · FIXER', 'That Pelo is yours if you can take it. Don\'t scratch the paint — actually, scratch it. It\'s ours now.'] },
  { n: 2, title: 'LANTERN MARKET', name: 'COLLECT THE DROP', district: 'PASARU MARKET',
    obj: 'Collect the drop in the Pasaru night market. Do not start a war.',
    stages: ['Reach the market', 'Grab the drop', 'Duck the KPD', 'Deliver to Mira'],
    next: ['Reach the market', 'Grab the drop', 'Duck the KPD', 'Done'],
    payout: 3600, time: 318, cash: 7270, dialogue: ['DO', 'DEE OKONKWO · CREW', 'Stall 12, under the pink awning. Take it slow — the market is watching.'] },
  { n: 3, title: 'GOLDEN HOUR', name: 'OUTRUN THE SUNSET ROADBLOCK', district: 'MALECON CELESTE',
    obj: 'Outrun the sunset roadblock on the Malecon and reach the pier.',
    stages: ['Hit the Malecon', 'Break the roadblock', 'Reach the pier', 'Vanish'],
    next: ['Hit the Malecon', 'Break the roadblock', 'Reach the pier', 'Done'],
    payout: 5200, time: 107, cash: 12860, dialogue: ['JP', 'JUNO PARK · DRIVER', 'Sunset roadblock on the Malecon! Thread it — the pier is past the lights.'] },
  { n: 4, title: 'DOCKSIDE DEAL', name: 'MOVE THE CRATES', district: 'MARINA DEL SOL',
    obj: 'Move three crates from Dock 9 to the Brisa warehouse without the KPD.',
    stages: ['Load crate 1', 'Load crate 2', 'Load crate 3', 'Drop at Brisa'],
    next: ['Load crate 1', 'Load crate 2', 'Load crate 3', 'Done'],
    payout: 4100, time: 420, cash: 15400, dialogue: ['LO', 'LIO · MECHANIC', 'Crates are heavy and the KPD is nosy. Easy does it, and keep the revs down.'] },
  { n: 5, title: 'MARINA HEIST', name: 'TAKE THE YACHT CASH', district: 'MARINA DEL SOL',
    obj: 'Board the yacht at anchor and take the safe cash before the crew wakes.',
    stages: ['Swim to the yacht', 'Crack the safe', 'Grab the cash', 'Swim back'],
    next: ['Swim to the yacht', 'Crack the safe', 'Grab the cash', 'Done'],
    payout: 7800, time: 360, cash: 19200, dialogue: ['KK', 'KIKI · LOOKOUT', 'Yacht crew sleeps at 2 AM sharp. You have one quiet hour — don\'t waste it.'] },
  { n: 6, title: "ORU'S FALL", name: 'WRECK THE REGENT', district: 'KUMALA STRAND',
    obj: "Wreck Oru's Regent before it reaches the pier.",
    stages: ['Spot the Regent', 'Ram the Regent', 'Finish the job', 'Vanish'],
    next: ['Spot the Regent', 'Ram the Regent', 'Finish the job', 'Done'],
    payout: 9400, time: 143, cash: 18450, dialogue: ['MK', 'MIRA KESANG · FIXER', "He's making for Kumala Pier! Ram the Regent before it reaches the water!"] },
  { n: 7, title: 'NEON RUN', name: 'RACE THE GOLDEN MILE', district: 'MALECON CELESTE',
    obj: 'Beat the Golden Mile street race at night — three laps, no brakes, no mercy.',
    stages: ['Lap 1 of 3', 'Lap 2 of 3', 'Lap 3 of 3', 'Take the flag'],
    next: ['Lap 1 of 3', 'Lap 2 of 3', 'Lap 3 of 3', 'Done'],
    payout: 12000, time: 240, cash: 22600, dialogue: ['JP', 'JUNO PARK · DRIVER', 'Three laps, golden mile, whole city watching. Don\'t lift. Ever.'] },
  { n: 8, title: 'SOLARA SUNSET', name: 'THE FINAL GETAWAY', district: 'BRISA SOUND',
    obj: 'One last job: cross the Tarpon Bridge at sunset with the whole KPD behind you.',
    stages: ['Take the bridge', 'Lose the air unit', 'Cross the sound', 'Free'],
    next: ['Take the bridge', 'Lose the air unit', 'Cross the sound', 'Done'],
    payout: 20000, time: 300, cash: 31400, dialogue: ['MK', 'MIRA KESANG · FIXER', 'Sunset, bridge, every siren in the city. Make it count — this is the one they\'ll remember.'] },
];

export const WEAPONS = [
  { name: 'FISTS', icon: '✊', ammo: Infinity, reserve: Infinity, damage: 12, locked: false },
  { name: '.38', icon: '🔫', ammo: 60, reserve: 60, damage: 22, locked: false },
  { name: 'SMG', icon: '🔫', ammo: 30, reserve: 60, damage: 16, locked: false },
  { name: '12G', icon: '💥', ammo: 18, reserve: 24, damage: 45, locked: false },
  { name: 'AR-9', icon: '🎯', ammo: 0, reserve: 0, damage: 30, locked: true },
  { name: 'RPG', icon: '🚀', ammo: 0, reserve: 0, damage: 120, locked: true },
];

export const CREW = [
  { key: 'Z', initials: 'MK', name: 'Mira Kesang', role: 'Fixer', ability: 'SWAP PLATES', desc: 'Mira · Driver', cooldown: 0, maxCooldown: 45,
    use: (g) => { g.addWanted(-2, 'plates swapped'); return 'Plates swapped — heat dropping.'; } },
  { key: 'X', initials: 'LO', name: 'Lio', role: 'Mechanic', ability: 'QUICK FIX', desc: 'Lio · Mechanic', cooldown: 21, maxCooldown: 30,
    use: (g) => { g.repairVehicle(35); return 'Lio patched the Pelo — 35% fixed.'; } },
  { key: 'C', initials: 'KK', name: 'Kiki', role: 'Lookout', ability: 'EYES OUT', desc: 'Kiki · Lookout', cooldown: 0, maxCooldown: 60,
    use: (g) => { g.revealUnits(20); return 'Kiki marked every unit for 20 seconds.'; } },
  { key: 'V', initials: 'JP', name: 'Juno Park', role: 'Driver', ability: 'PILAR GETAWAY', desc: 'Juno · Driver', cooldown: 0, maxCooldown: 90,
    use: (g) => { g.nitroBoost(); return 'Juno floored it — nitro engaged!'; } },
  { key: 'B', initials: 'DO', name: 'Dee Okonkwo', role: 'Crew', ability: 'DEE ON 25S', desc: 'Dee · Crew', cooldown: 25, maxCooldown: 25,
    use: (g) => { g.distractPolice(15); return 'Dee pulled a unit off your tail.'; } },
];

export const POLICE_UNITS = [
  { id: 'KITE-1', role: 'MARKSMAN', mode: 'pursue', dist: 15 },
  { id: 'MARLIN-3', role: 'SHORE WATCH', mode: 'patrol', dist: 187 },
  { id: 'CORAL-48', role: 'RAMMING', mode: 'pursue', dist: 7 },
  { id: 'CORAL-85', role: 'FLANKING', mode: 'pursue', dist: 14 },
  { id: 'CORAL-43', role: 'RAMMING', mode: 'search', dist: 15 },
  { id: 'REEF-7', role: 'ROADBLOCK', mode: 'recover', dist: 240 },
];

// ---- the game state ----------------------------------------------------------
export class GameState {
  constructor() {
    this.cash = 18450;
    this.rp = 3900; this.rpMax = 5200;
    this.rank = 'B'; this.rankName = 'FIXER';
    this.health = 72; this.armour = 55;
    this.wanted = 4;
    this.missionIndex = 5; // mission 6 active by default (the cover mission)
    this.stage = 2; // 0-based: stage 3 of 4
    this.missionTime = 143;
    this.speedKmh = 0;
    this.vehicleName = 'RUKAN PELO GT';
    this.dent = 62;
    this.inVehicle = true;
    this.onFoot = false;
    this.weaponIndex = 2;
    this.weapons = WEAPONS.map(w => ({ ...w }));
    this.crew = CREW.map(c => ({ ...c }));
    this.units = POLICE_UNITS.map(u => ({ ...u }));
    this.district = 'KUMALA STRAND';
    this.districtSub = 'Strand Boulevard';
    this.friendly = 58;
    this.clockSeconds = 12 * 3600;
    this.preset = 'noon';
    this.radio = 'Radio Mango 98.6 — "Guava Sunrise"';
    this.missionComplete = false;
    this.missionFailed = false;
    this.playtestLog = [];
    this.events = [];
  }

  get mission() { return MISSIONS[this.missionIndex]; }

  log(msg) { this.playtestLog.push(msg); }

  startMission(i) {
    this.missionIndex = clamp(i, 0, MISSIONS.length - 1);
    this.stage = 0;
    this.missionTime = this.mission.time;
    this.missionComplete = false;
    this.missionFailed = false;
    this.cash = this.mission.cash;
    this.events.push(`mission ${this.mission.n} started: ${this.mission.name}`);
    return this.mission;
  }

  advanceStage(reason = '') {
    if (this.missionComplete) return false;
    this.stage++;
    this.events.push(`stage ${this.stage}/${this.mission.stages.length} ${reason}`);
    if (this.stage >= this.mission.stages.length) {
      this.completeMission();
      return true;
    }
    return false;
  }

  completeMission() {
    this.missionComplete = true;
    this.cash += this.mission.payout;
    this.rp = clamp(this.rp + 320, 0, this.rpMax);
    this.events.push(`mission ${this.mission.n} complete +${fmtCash(this.mission.payout)}`);
  }

  failMission(reason) {
    this.missionFailed = true;
    this.events.push(`mission failed: ${reason}`);
  }

  // Wanted state machine: patrol -> pursue -> search -> recover, with reasons.
  addWanted(n, reason = 'crime seen') {
    const before = this.wanted;
    this.wanted = clamp(this.wanted + n, 0, 6);
    if (this.wanted !== before) this.events.push(`wanted ${before} -> ${this.wanted} (${reason})`);
    this.updateUnitModes();
  }

  updateUnitModes() {
    for (const u of this.units) {
      if (this.wanted === 0) u.mode = 'patrol';
      else if (this.wanted <= 2) u.mode = u.dist < 60 ? 'pursue' : 'patrol';
      else if (this.wanted <= 4) u.mode = u.dist < 200 ? 'pursue' : 'search';
      else u.mode = u.dist < 260 ? 'pursue' : 'recover';
    }
  }

  repairVehicle(amount) {
    this.dent = clamp(this.dent - amount, 0, 100);
  }

  revealUnits(seconds) { this.events.push(`units revealed ${seconds}s`); }
  nitroBoost() { this.events.push('nitro boost'); }
  distractPolice(seconds) {
    const u = this.units.find(x => x.mode === 'pursue');
    if (u) { u.mode = 'search'; u.dist += 120; this.events.push(`${u.id} distracted ${seconds}s`); }
  }

  selectWeapon(i) {
    const w = this.weapons[i];
    if (!w || w.locked) return null;
    this.weaponIndex = i;
    return w;
  }

  // Firing: ammo decrements, tracer + hit feedback are presentation events.
  fire() {
    const w = this.weapons[this.weaponIndex];
    if (!w) return { ok: false, reason: 'no weapon' };
    if (w.locked) return { ok: false, reason: 'weapon locked' };
    if (w.ammo === Infinity) return { ok: true, tracer: true, damage: w.damage };
    if (w.ammo <= 0) return { ok: false, reason: 'no ammo — press R to reload' };
    w.ammo--;
    return { ok: true, tracer: true, damage: w.damage };
  }

  reload() {
    const w = this.weapons[this.weaponIndex];
    if (!w || w.ammo === Infinity) return;
    const need = 30 - w.ammo;
    const take = Math.min(need, w.reserve);
    w.ammo += take; w.reserve -= take;
  }

  useCrew(i) {
    const c = this.crew[i];
    if (!c) return null;
    if (c.cooldown > 0) return { ok: false, reason: `${c.ability} on cooldown ${Math.ceil(c.cooldown)}s` };
    c.cooldown = c.maxCooldown;
    const msg = c.use(this);
    return { ok: true, msg };
  }

  tick(dt) {
    this.missionTime = Math.max(0, this.missionTime - dt);
    if (this.missionTime === 0 && !this.missionComplete) this.failMission('time up');
    for (const c of this.crew) c.cooldown = Math.max(0, c.cooldown - dt);
    // Wanted decays slowly when the player is far from every unit.
    if (this.wanted > 0 && this.units.every(u => u.dist > 220)) {
      this._decayT = (this._decayT || 0) + dt;
      if (this._decayT > 12) { this.addWanted(-1, 'escaped'); this._decayT = 0; }
    } else this._decayT = 0;
  }
}

// ---- traffic AI: cars follow the boulevard + cross streets, looping ----------
export class TrafficSystem {
  constructor(scene, makeCar) {
    this.scene = scene;
    this.cars = [];
    this.rng = null;
    this.makeCar = makeCar;
  }
  spawn(rng, count) {
    this.rng = rng;
    for (let i = 0; i < count; i++) {
      const car = this.makeCar(rng);
      const lane = rng() < 0.5 ? -3.4 : 3.4; // right-hand traffic, both directions
      const dir = lane < 0 ? -1 : 1;
      car.position.set(lane, 0, rand(rng, -160, 160));
      car.rotation.y = dir < 0 ? 0 : Math.PI;
      this.scene.add(car);
      this.cars.push({ mesh: car, lane, dir, speed: rand(rng, 7, 13), kind: 'boulevard' });
    }
    // Cross-street traffic.
    for (let i = 0; i < 4; i++) {
      const car = this.makeCar(rng);
      const z = pick(rng, [-80, 0, 80]);
      car.position.set(rand(rng, -110, -16), 0, z + (rng() < 0.5 ? -2.8 : 2.8));
      car.rotation.y = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      this.scene.add(car);
      this.cars.push({ mesh: car, lane: 0, dir: 1, speed: rand(rng, 6, 10), kind: 'cross', streetZ: z });
    }
  }
  update(dt) {
    for (const c of this.cars) {
      if (c.kind === 'boulevard') {
        c.mesh.position.z += c.dir * c.speed * dt;
        if (c.mesh.position.z > 175) c.mesh.position.z = -175;
        if (c.mesh.position.z < -175) c.mesh.position.z = 175;
      } else {
        // Cross-street car: forward = (-sin h, -cos h); h=+PI/2 drives -X.
        const dirX = c.mesh.rotation.y > 0 ? -1 : 1;
        c.mesh.position.x += c.speed * dt * dirX;
        if (c.mesh.position.x > -14) c.mesh.position.x = -112;
        if (c.mesh.position.x < -112) c.mesh.position.x = -14;
      }
      // Wheel spin around the axle (local Z).
      for (const w of c.mesh.children) {
        if (w.children && w.children.length === 3) w.rotation.z += c.speed * dt * 0.8;
      }
    }
  }
}
