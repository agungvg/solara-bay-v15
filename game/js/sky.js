// sky.js — one sun, one palette, one fog colour: sky dome, sun disc, stars and
// Tier-2 billboard clouds, all driven by a single time-of-day preset.
// Clouds are clusters of flattened white spheres (MeshBasicMaterial, fog:false)
// so they stay soft white — never a grey pancake underside.
import * as THREE from 'three';
import { mulberry32, rand, lerp, TAU } from './utils.js';

export const SKY_PRESETS = {
  noon: {
    name: 'noon', clock: '12:00',
    zenith: new THREE.Color(0x2f7fe0), mid: new THREE.Color(0x7db8f0), horizon: new THREE.Color(0xcfe8ff),
    sunDir: new THREE.Vector3(0.25, 0.92, 0.3).normalize(),
    sunColour: 0xfff6e0, sunIntensity: 2.7, hemiSky: 0xbfd9ff, hemiGround: 0x8a7a5e, hemiIntensity: 1.35,
    fog: new THREE.Color(0xcfe8ff), fogNear: 120, fogFar: 620, exposure: 1.05,
    cloudTint: 0xffffff, cloudOpacity: 0.92, stars: 0, sunGlow: 0.55,
  },
  golden: {
    name: 'golden', clock: '17:45',
    zenith: new THREE.Color(0x5b2a72), mid: new THREE.Color(0xc65a7a), horizon: new THREE.Color(0xff9e5e),
    sunDir: new THREE.Vector3(-0.55, 0.22, -0.8).normalize(),
    sunColour: 0xffb36b, sunIntensity: 2.3, hemiSky: 0xff9e7a, hemiGround: 0x5a3a34, hemiIntensity: 0.85,
    fog: new THREE.Color(0xff9e6b), fogNear: 100, fogFar: 560, exposure: 1.0,
    cloudTint: 0xffd9c2, cloudOpacity: 0.9, stars: 0.08, sunGlow: 0.9,
  },
  night: {
    name: 'night', clock: '21:30',
    zenith: new THREE.Color(0x060a1e), mid: new THREE.Color(0x0e1a3a), horizon: new THREE.Color(0x2a3a5e),
    sunDir: new THREE.Vector3(-0.3, 0.5, 0.4).normalize(), // moon direction
    sunColour: 0xcfe0ff, sunIntensity: 0.35, hemiSky: 0x2a3a66, hemiGround: 0x141018, hemiIntensity: 0.5,
    fog: new THREE.Color(0x1a2440), fogNear: 90, fogFar: 480, exposure: 0.95,
    cloudTint: 0x8fa3c8, cloudOpacity: 0.55, stars: 1, sunGlow: 0.25,
  },
};

const SKY_VERT = `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // pin to far plane
}`;

const SKY_FRAG = `
varying vec3 vDir;
uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon;
uniform vec3 uSunDir; uniform vec3 uSunColour; uniform float uSunGlow;
uniform float uStars; uniform float uTime;
float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.08, 1.0);
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
  col = mix(col, uZenith, smoothstep(0.18, 0.75, h));
  float sunAmt = max(dot(d, normalize(uSunDir)), 0.0);
  // Sun disc + wide warm glow, same direction as the directional light.
  col += uSunColour * pow(sunAmt, 900.0) * 3.0;
  col += uSunColour * pow(sunAmt, 18.0) * uSunGlow * 0.55;
  col += uSunColour * pow(sunAmt, 4.0) * uSunGlow * 0.16;
  // Hash stars, only at night.
  if (uStars > 0.01 && d.y > 0.05) {
    vec3 cell = floor(d * 160.0);
    float s = hash(cell);
    float star = step(0.9975, s) * uStars * smoothstep(0.05, 0.4, d.y);
    col += vec3(star * 0.9);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export class SkySystem {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.uniforms = {
      uZenith: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColour: { value: new THREE.Color(0xffffff) },
      uSunGlow: { value: 0.55 },
      uStars: { value: 0 },
      uTime: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(880, 32, 20);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    // Key light + hemisphere fill, both driven by the same preset.
    this.sun = new THREE.DirectionalLight(0xffffff, 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 420;
    this.sun.shadow.camera.left = -130; this.sun.shadow.camera.right = 130;
    this.sun.shadow.camera.top = 130; this.sun.shadow.camera.bottom = -130;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5e, 1.0);
    scene.add(this.hemi);

    this.clouds = this.buildClouds(scene);
    this.preset = null;
    this.applyPreset('noon');
  }

  buildClouds(scene) {
    // Tier 2: 10 cloud groups, each 4–7 flattened white spheres, 2 drift layers.
    const rng = mulberry32(20261123);
    const group = new THREE.Group();
    const geo = new THREE.SphereGeometry(1, 24, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
    const clouds = [];
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Group();
      const puffs = 4 + Math.floor(rng() * 4);
      const spread = 9 + rng() * 10;
      for (let p = 0; p < puffs; p++) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set((rng() - 0.5) * spread, (rng() - 0.5) * 2.4, (rng() - 0.5) * spread * 0.55);
        const s = 4.5 + rng() * 5.5;
        m.scale.set(s, s * (0.32 + rng() * 0.14), s * 0.7);
        c.add(m);
      }
      const high = i % 3 === 0;
      c.position.set(rand(rng, -260, 260), high ? 78 + rng() * 22 : 52 + rng() * 16, rand(rng, -280, 60));
      c.userData.speed = high ? 0.55 : 1.15; // high layer drifts slower
      group.add(c);
      clouds.push(c);
    }
    scene.add(group);
    return { group, clouds, mat };
  }

  applyPreset(name) {
    const p = SKY_PRESETS[name];
    if (!p) return;
    this.preset = p;
    const u = this.uniforms;
    u.uZenith.value.copy(p.zenith); u.uMid.value.copy(p.mid); u.uHorizon.value.copy(p.horizon);
    u.uSunDir.value.copy(p.sunDir); u.uSunColour.value.set(p.sunColour);
    u.uSunGlow.value = p.sunGlow; u.uStars.value = p.stars;
    this.sun.position.copy(p.sunDir).multiplyScalar(180);
    this.sun.target.position.set(0, 0, 0);
    this.sun.color.set(p.sunColour); this.sun.intensity = p.sunIntensity;
    this.hemi.color.set(p.hemiSky); this.hemi.groundColor.set(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    this.scene.fog = new THREE.Fog(p.fog, p.fogNear, p.fogFar);
    this.renderer.toneMappingExposure = p.exposure;
    this.clouds.mat.color.set(p.cloudTint);
    this.clouds.mat.opacity = p.cloudOpacity;
    // Re-centre the dome on the camera target each frame in update().
  }

  update(dt, t, focus) {
    this.uniforms.uTime.value = t;
    this.dome.position.copy(focus);
    // Keep the sun + shadow frustum centred on the action, not the world origin.
    this.sun.position.copy(focus).addScaledVector(this.preset.sunDir, 180);
    this.sun.target.position.copy(focus);
    for (const c of this.clouds.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 300) c.position.x = -300;
    }
  }
}
