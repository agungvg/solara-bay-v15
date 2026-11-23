// textures.js — every surface texture in Solara Bay is drawn on a 2D canvas here.
// Facades are 1024x1024: smooth vertical gradient + subtle noise + dense window
// grid + rounded corner columns, so buildings read smooth, never flat or blocky.
import * as THREE from 'three';
import { mulberry32, rand, speckle, vGrad, roundRect } from './utils.js';

function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

// ---- building facades -------------------------------------------------------
const FACADE_PALETTES = [
  { top: '#f2d7a8', mid: '#e8bf85', base: '#c99a5e', win: '#2e4a66', lit: '#ffd98a', trim: '#fff3d6' },
  { top: '#f6e3c2', mid: '#eec99a', base: '#d9a86c', win: '#33506e', lit: '#ffe1a0', trim: '#fff8e2' },
  { top: '#e9c9b8', mid: '#dba98f', base: '#b97f60', win: '#2b3f57', lit: '#ffcf7d', trim: '#ffe9d2' },
  { top: '#dfe9ef', mid: '#c4d3dd', base: '#9fb2c2', win: '#27435e', lit: '#ffe9a8', trim: '#f4fafd' },
  { top: '#f0cfa0', mid: '#e3b478', base: '#bd8f52', win: '#2c465f', lit: '#ffdf8e', trim: '#fff0cf' },
  { top: '#e6d3e8', mid: '#d3b3d6', base: '#ac84b0', win: '#33254a', lit: '#ffd166', trim: '#f7e9f7' },
];

export function facadeTexture(seed) {
  const rng = mulberry32(seed);
  const pal = FACADE_PALETTES[Math.floor(rng() * FACADE_PALETTES.length)];
  const [c, ctx] = [document.createElement('canvas'), null];
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  // Smooth vertical gradient: bright top, warm mid, shaded base.
  vGrad(g, 0, 0, 1024, 1024, [[0, pal.top], [0.45, pal.mid], [1, pal.base]]);
  speckle(g, rng, 0, 0, 1024, 1024, 2600, 0.05);
  // Soft horizontal floor bands.
  const floors = 6 + Math.floor(rng() * 5);
  const fh = 1024 / floors;
  g.fillStyle = 'rgba(0,0,0,0.07)';
  for (let f = 1; f < floors; f++) g.fillRect(0, f * fh - 3, 1024, 6);
  // Dense window grid: rounded-corner panes with varied glass + a few lit.
  const cols = 8 + Math.floor(rng() * 4);
  const cw = 1024 / cols;
  for (let f = 0; f < floors; f++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw + cw * 0.2, y = f * fh + fh * 0.22;
      const w = cw * 0.6, h = fh * 0.56;
      const lit = rng() < 0.16;
      g.fillStyle = 'rgba(0,0,0,0.22)';
      roundRect(g, x + 3, y + 4, w, h, 7); g.fill();
      const gg = g.createLinearGradient(x, y, x, y + h);
      if (lit) { gg.addColorStop(0, '#fff3c4'); gg.addColorStop(1, pal.lit); }
      else { gg.addColorStop(0, '#5a7ea6'); gg.addColorStop(1, pal.win); }
      g.fillStyle = gg;
      roundRect(g, x, y, w, h, 7); g.fill();
      // Window cross-mullion, soft.
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x + w / 2 - 1.5, y, 3, h);
      g.fillRect(x, y + h / 2 - 1.5, w, 3);
    }
  }
  // Rounded corner columns: two soft vertical pillars at the edges.
  for (const cx of [0, 1024]) {
    const grad = g.createLinearGradient(cx - 26, 0, cx + 26, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, pal.trim);
    grad.addColorStop(1, 'rgba(0,0,0,0.10)');
    g.fillStyle = grad;
    g.fillRect(cx - 26, 0, 52, 1024);
  }
  // Base trim + cornice.
  g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, 1024 - 34, 1024, 34);
  g.fillStyle = pal.trim; g.fillRect(0, 1024 - 40, 1024, 7);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, 1024, 10);
  return toTexture(c);
}

// ---- road -------------------------------------------------------------------
export function roadTexture(seed, sunset = false) {
  const rng = mulberry32(seed);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  // Warm wet sunset road vs cool noon asphalt: smooth gradient, no hard banding.
  if (sunset) vGrad(g, 0, 0, 1024, 1024, [[0, '#4a2b33'], [0.5, '#5d3238'], [1, '#3c2229']]);
  else vGrad(g, 0, 0, 1024, 1024, [[0, '#4b4f57'], [0.5, '#3f434b'], [1, '#34383f']]);
  speckle(g, rng, 0, 0, 1024, 1024, 4200, 0.06);
  // Soft sheen streaks (wet look) — blurred light bands along the road.
  for (let i = 0; i < 7; i++) {
    const x = rng() * 1024;
    const gg = g.createLinearGradient(x - 60, 0, x + 60, 0);
    gg.addColorStop(0, 'rgba(255,255,255,0)');
    gg.addColorStop(0.5, sunset ? 'rgba(255,150,90,0.10)' : 'rgba(255,255,255,0.07)');
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gg; g.fillRect(x - 60, 0, 120, 1024);
  }
  // Centre double yellow, soft edges.
  g.fillStyle = '#e8b93a';
  g.fillRect(498, 0, 9, 1024); g.fillRect(517, 0, 9, 1024);
  g.fillStyle = 'rgba(232,185,58,0.35)';
  g.fillRect(492, 0, 6, 1024); g.fillRect(526, 0, 6, 1024);
  // Lane dashes, soft white.
  g.fillStyle = 'rgba(240,244,250,0.92)';
  for (let y = 0; y < 1024; y += 128) {
    roundRect(g, 296, y + 18, 10, 74, 5); g.fill();
    roundRect(g, 718, y + 18, 10, 74, 5); g.fill();
  }
  // Edge lines.
  g.fillStyle = 'rgba(240,244,250,0.75)';
  g.fillRect(52, 0, 7, 1024); g.fillRect(965, 0, 7, 1024);
  // Tyre-wear darkening in the wheel tracks.
  for (const x of [180, 380, 644, 844]) {
    const gg = g.createLinearGradient(x - 46, 0, x + 46, 0);
    gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(0.5, 'rgba(0,0,0,0.16)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gg; g.fillRect(x - 46, 0, 92, 1024);
  }
  return toTexture(c);
}

// ---- sand / water ------------------------------------------------------------
export function sandTexture(seed) {
  const rng = mulberry32(seed);
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  vGrad(g, 0, 0, 512, 512, [[0, '#f2ddab'], [0.6, '#e8cd92'], [1, '#dcbc7d']]);
  speckle(g, rng, 0, 0, 512, 512, 3200, 0.08);
  // Gentle dune ripples.
  g.strokeStyle = 'rgba(120,90,40,0.10)'; g.lineWidth = 5;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    const y0 = i * 60 + rng() * 20;
    g.moveTo(0, y0);
    for (let x = 0; x <= 512; x += 64) g.lineTo(x, y0 + Math.sin(x / 90 + i) * 9);
    g.stroke();
  }
  return toTexture(c, 6, 6);
}

export function waterTexture(seed) {
  const rng = mulberry32(seed);
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  vGrad(g, 0, 0, 512, 512, [[0, '#2f8fd0'], [0.5, '#1f6fb0'], [1, '#17609e']]);
  // Wave streaks, horizontal, soft.
  for (let i = 0; i < 46; i++) {
    const y = rng() * 512, len = 60 + rng() * 200, x = rng() * 512;
    g.strokeStyle = `rgba(255,255,255,${0.05 + rng() * 0.13})`;
    g.lineWidth = 1.5 + rng() * 2.5;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + len / 2, y + (rng() - 0.5) * 10, x + len, y + (rng() - 0.5) * 6);
    g.stroke();
  }
  speckle(g, rng, 0, 0, 512, 512, 900, 0.05);
  return toTexture(c, 8, 8);
}

export function foamTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  const rng = mulberry32(77);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${0.25 + rng() * 0.5})`;
    g.beginPath(); g.arc(rng() * 256, rng() * 256, 1 + rng() * 5, 0, 6.283); g.fill();
  }
  return toTexture(c, 10, 1);
}

// ---- signs -------------------------------------------------------------------
export function signTexture(text, bg, fg, sub = '') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 10;
  g.strokeRect(10, 10, 492, 236);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 96px "Segoe UI", Arial, sans-serif';
  g.fillText(text, 256, sub ? 108 : 128);
  if (sub) { g.font = '700 40px "Segoe UI", Arial, sans-serif'; g.fillText(sub, 256, 196); }
  return toTexture(c);
}

// Full-word POLICE door decal — wide canvas so the whole word fits, never cut.
export function policeDoorTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = '#0d1526'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 84px "Segoe UI", Arial, sans-serif';
  g.fillText('POLICE', 256, 66);
  g.fillStyle = '#0d1526'; g.fillRect(24, 108, 464, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function awningTexture(seed, c1, c2) {
  const rng = mulberry32(seed);
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 ? c1 : c2;
    g.fillRect((i * 256) / stripes, 0, 256 / stripes, 256);
  }
  speckle(g, rng, 0, 0, 256, 256, 300, 0.05);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 226, 256, 30);
  return toTexture(c);
}

export function neonTexture(text, colour) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 192;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 192);
  g.font = '900 92px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = colour; g.shadowBlur = 34;
  g.fillStyle = colour; g.fillText(text, 256, 96);
  g.shadowBlur = 10; g.fillStyle = '#ffffff';
  g.fillText(text, 256, 96);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
