// player.js — input mapping, on-foot controller, arcade driving, and the
// collision-aware third-person camera. One authority controls the player at a
// time: enter/exit is a session with a single handoff point.
import * as THREE from 'three';
import { clamp, lerp } from './utils.js';

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, consumed once per frame
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.mouseDX = 0; this.mouseDY = 0;
    this.dragging = false;
    window.addEventListener('mousedown', (e) => { if (e.button === 0) this.dragging = true; });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (this.dragging) { this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0; }
    });
  }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.mouseDX = 0; this.mouseDY = 0; }
}

const WORLD = { xMin: -110, xMax: 43, zMin: -168, zMax: 168 };

export class PlayerController {
  constructor(scene, heroCar, pedMesh) {
    this.scene = scene;
    this.heroCar = heroCar;
    this.ped = pedMesh; // the on-foot player mesh (jointed ped)
    this.mode = 'drive';
    this.pos = new THREE.Vector3(0, 0, 55);
    this.heading = 0; // facing north (-Z): forward = (-sin h, 0, -cos h)
    this.speed = 0; // m/s
    this.steer = 0;
    this.velY = 0;
    this.grounded = true;
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.camDist = 9.5;
    this.camPos = new THREE.Vector3(-7, 4.5, 78);
    this.camTarget = new THREE.Vector3(0, 1.5, 40);
    this.heroCar.position.copy(this.pos);
    this.heroCar.rotation.y = this.heading;
    this.ped.group.visible = false;
  }

  // Enter/exit session: exactly one owner after the call.
  enterCar() {
    if (this.mode === 'drive') return false;
    const d = this.ped.group.position.distanceTo(this.heroCar.position);
    if (d > 3.5) return false;
    this.mode = 'drive';
    this.pos.copy(this.heroCar.position);
    this.heading = this.heroCar.rotation.y;
    this.ped.group.visible = false;
    return true;
  }
  exitCar() {
    if (this.mode !== 'drive') return false;
    this.mode = 'foot';
    // Safe dismount: to the left of the car, on walkable ground.
    const side = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    const p = this.pos.clone().addScaledVector(side, 2.2);
    p.x = clamp(p.x, WORLD.xMin, WORLD.xMax);
    p.z = clamp(p.z, WORLD.zMin, WORLD.zMax);
    this.ped.group.position.copy(p);
    this.ped.group.visible = true;
    this.ped.group.rotation.y = this.heading;
    this.speed = 0;
    return true;
  }

  update(dt, input, state, t) {
    // Camera orbit (mouse drag) always works.
    this.camYaw -= input.mouseDX * 0.0035;
    this.camPitch = clamp(this.camPitch + input.mouseDY * 0.002, 0.08, 0.9);

    if (this.mode === 'drive') this.updateDrive(dt, input, state);
    else this.updateFoot(dt, input, state, t);

    if (input.hit('KeyE')) {
      if (this.mode === 'drive') this.exitCar();
      else if (this.enterCar()) state.events.push('entered vehicle');
    }
    this.updateCamera(dt);
    // NOTE: input.endFrame() is called by the main loop after all systems
    // have read this frame's edge-triggered keys.
  }

  updateDrive(dt, input, state) {
    // Autopilot (playtest only): steer toward the waypoint, full throttle.
    let accel = input.down('KeyW') || input.down('ArrowUp') ? 14 : 0;
    let brake = input.down('KeyS') || input.down('ArrowDown') ? 1 : 0;
    let hand = input.down('Space') ? 1 : 0;
    let steerIn = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0) - (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
    if (this.autopilot) {
      const dx = this.autopilot.x - this.pos.x;
      const dz = this.autopilot.z - this.pos.z;
      const want = Math.atan2(-dx, -dz);
      let err = want - this.heading;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      steerIn = clamp(err * 1.6, -1, 1);
      accel = 14;
      brake = 0; hand = 0;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) this.autopilot.arrived = true;
    }
    this.steer = lerp(this.steer, steerIn, Math.min(1, dt * 8));
    // Arcade handling: accelerate, drag, brake, handbrake slide.
    this.speed += accel * dt;
    this.speed -= this.speed * (hand ? 2.2 : 0.55) * dt;
    if (brake) this.speed -= 22 * dt;
    this.speed = clamp(this.speed, -8, 32);
    if (!accel && Math.abs(this.speed) < 0.3) this.speed = 0;
    const turnRate = this.steer * (0.9 + Math.min(1, Math.abs(this.speed) / 20) * 1.1) * (this.speed >= 0 ? 1 : -1);
    this.heading += turnRate * dt * (hand ? 1.5 : 1);
    const forward = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    this.pos.addScaledVector(forward, this.speed * dt);
    // World bounds + keep out of the ocean and the building rows.
    this.pos.x = clamp(this.pos.x, -11.5, 42);
    this.pos.z = clamp(this.pos.z, WORLD.zMin, WORLD.zMax);
    if (Math.abs(this.pos.x) < 7.4 && Math.abs(this.speed) > 0.1) {
      // On the road: nothing blocks the boulevard itself.
    }
    this.heroCar.position.copy(this.pos);
    this.heroCar.rotation.y = this.heading;
    // Wheel spin + body lean.
    const spin = this.speed * dt * 2.2;
    for (const w of this.heroCar.userData.wheels || []) w.rotation.z += spin;
    this.heroCar.rotation.z = -this.steer * 0.03 * Math.min(1, Math.abs(this.speed) / 15);
    this.heroCar.rotation.x = clamp(-accel * 0.0012, -0.02, 0.02);
    state.speedKmh = Math.abs(this.speed) * 3.6;
    state.inVehicle = true;
  }

  updateFoot(dt, input, state, t) {
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const spd = run ? 6.2 : 3.4;
    let fx = 0, fz = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) fz -= 1;
    if (input.down('KeyS') || input.down('ArrowDown')) fz += 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) fx -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) fx += 1;
    const moving = fx !== 0 || fz !== 0;
    if (moving) {
      const len = Math.hypot(fx, fz);
      fx /= len; fz /= len;
      // Movement is relative to the camera yaw.
      const yaw = this.camYaw;
      const wx = fx * Math.cos(yaw) - fz * Math.sin(yaw);
      const wz = fx * Math.sin(yaw) + fz * Math.cos(yaw);
      const p = this.ped.group.position;
      p.x = clamp(p.x + wx * spd * dt, WORLD.xMin, WORLD.xMax);
      p.z = clamp(p.z + wz * spd * dt, WORLD.zMin, WORLD.zMax);
      this.ped.group.rotation.y = Math.atan2(wx, wz);
      this.pos.copy(p);
    }
    // Jump with simple gravity.
    if (input.hit('Space') && this.grounded) { this.velY = 5.2; this.grounded = false; }
    if (!this.grounded) {
      this.velY -= 14 * dt;
      const p = this.ped.group.position;
      p.y += this.velY * dt;
      if (p.y <= 0) { p.y = 0; this.velY = 0; this.grounded = true; }
    }
    state.speedKmh = moving ? spd * 3.6 : 0;
    state.inVehicle = false;
    state.onFoot = true;
  }

  updateCamera(dt) {
    // Staged screenshots freeze the camera exactly where stageShot put it.
    if (this.freezeCamera) return;
    // Chase camera: behind the player, smoothed; mouse drag orbits.
    const anchor = this.mode === 'drive' ? this.heroCar.position : this.ped.group.position;
    // Behind = -forward * dist; forward = (-sin h, 0, -cos h), so behind = (sin h, 0, cos h).
    const yaw = this.mode === 'drive' ? this.heading + this.camYaw : this.camYaw;
    const dist = this.mode === 'drive' ? 10.5 : 7.5;
    const height = this.mode === 'drive' ? 3.6 : 2.6;
    const desired = new THREE.Vector3(
      anchor.x + Math.sin(yaw) * dist,
      anchor.y + height + Math.sin(this.camPitch) * 4,
      anchor.z + Math.cos(yaw) * dist,
    );
    // Keep the camera out of the ocean wall and above ground.
    desired.x = clamp(desired.x, -60, 44);
    desired.y = Math.max(desired.y, 1.2);
    this.camPos.lerp(desired, Math.min(1, dt * 5));
    this.camTarget.lerp(new THREE.Vector3(anchor.x, anchor.y + 1.6, anchor.z), Math.min(1, dt * 8));
  }

  // Deterministic staged camera for screenshots (overrides the follow cam).
  setShotCamera(pos, target) {
    this.camPos.set(...pos);
    this.camTarget.set(...target);
    this.freezeCamera = true;
  }
}
