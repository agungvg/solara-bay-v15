// meta.js — the MAP / STATS / CREW / WORKSHOP / SAVE screen: the 66.1% completion
// ring, progress tracks, mission ratings, career stats, district standing, the
// Dock 9 workshop, weapons & gear, and the 3 save slots (slot 1 filled).
import { fmtCash } from './utils.js';
import { DISTRICTS } from './city.js';
import { MISSIONS, WEAPONS } from './gameplay.js';

const $ = (id) => document.getElementById(id);

const PROGRESS = [
  ['Story missions', 5, 8], ['Street races', 3, 6], ['Stunt jumps', 7, 12],
  ['Collectibles', 18, 30], ['Export list', 4, 10], ['District jobs', 11, 20],
  ['Districts friendly', 5, 8], ['Crew recruited', 4, 6],
];
const RATINGS = ['G', 'S', 'G', 'B', 'S', '—', '—', '—'];
const CAREER = [
  ['41', 'Cars stolen'], ['17', 'Cops escaped'], ['4★', 'Highest wanted'],
  ['312 km', 'Distance driven'], ['23', 'People taken out'], ['48 m', 'Longest jump'],
  ['4', 'Crew recruited'], ['9', 'Hidden by locals'],
];

export class MetaScreen {
  constructor(state, saveApi) {
    this.state = state;
    this.saveApi = saveApi;
    this.open = false;
    this.buildStatic();
  }

  buildStatic() {
    $('districtList').innerHTML = DISTRICTS.map(d => `
      <div class="mrow"><span style="width:150px">${d.name}</span>
      <span class="bar"><i style="width:${d.friendly}%"></i></span><b>${d.friendly}</b></div>`).join('');
    $('progressList').innerHTML = PROGRESS.map(([label, got, total]) => `
      <div class="mrow"><span>${label}</span>
      <span class="bar"><i style="width:${Math.round(got / total * 100)}%"></i></span><b>${got}/${total}</b></div>`).join('');
    $('rateList').innerHTML = RATINGS.map((r, i) => `<div><b>${r}</b><span>M${i + 1}</span></div>`).join('');
    $('careerList').innerHTML = CAREER.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    $('gearList').innerHTML = WEAPONS.map((w, i) => `
      <div class="mrow"><span>${i + 1}. ${w.name}</span>
      <b class="${w.locked ? 'lock' : ''}">${w.locked ? 'LOCKED' : (w.ammo === Infinity ? '∞' : w.ammo + '/' + w.reserve)}</b></div>`).join('');
  }

  refreshSaves() {
    const slots = this.saveApi.listSlots();
    $('saveList').innerHTML = slots.map((s, i) => `
      <div class="mrow"><span>SLOT ${i + 1}</span>
      <b>${s ? `${fmtCash(s.cash)} · ${s.missionsDone}/8 · ${s.date}` : 'EMPTY SLOT'}</b></div>`).join('');
  }

  drawMap() {
    const cv = $('map2d');
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d1526'; ctx.fillRect(0, 0, W, H);
    // Ocean (east third) + beach strip.
    ctx.fillStyle = '#1f6fb0'; ctx.fillRect(W * 0.72, 0, W * 0.28, H);
    ctx.fillStyle = '#e8cd92'; ctx.fillRect(W * 0.66, 0, W * 0.06, H);
    // City grid.
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
    for (let x = 30; x < W * 0.66; x += 62) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 30; y < H; y += 62) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W * 0.66, y); ctx.stroke(); }
    // Boulevard + cross streets.
    ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(W * 0.33, 0); ctx.lineTo(W * 0.33, H); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 5;
    for (const y of [H * 0.27, H * 0.5, H * 0.73]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W * 0.66, y); ctx.stroke(); }
    // District markers + labels.
    ctx.font = '700 17px "Segoe UI", Arial';
    for (const d of DISTRICTS) {
      const mx = ((d.x + 110) / 155) * (W * 0.66);
      const my = ((d.z + 170) / 340) * H;
      ctx.fillStyle = '#37e08b';
      ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8eefc';
      ctx.fillText(d.name, mx + 11, my + 6);
    }
    // Route to Kumala Pier (dashed magenta) + player arrow.
    const px = ((this.state.playerX ?? 0) + 110) / 155 * (W * 0.66);
    const py = ((this.state.playerZ ?? 55) + 170) / 340 * H;
    ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 4; ctx.setLineDash([12, 9]);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(W * 0.42, H * 0.08); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.moveTo(W * 0.42, H * 0.08 - 14); ctx.lineTo(W * 0.42 + 12, H * 0.08 + 10); ctx.lineTo(W * 0.42 - 12, H * 0.08 + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffb02e';
    ctx.save(); ctx.translate(px, py); ctx.rotate(this.state.playerHeading ?? 0);
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(12, 13); ctx.lineTo(0, 7); ctx.lineTo(-12, 13); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#c9d4ea'; ctx.font = '700 16px "Segoe UI", Arial';
    ctx.fillText('N', 14, 26);
  }

  toggle(force) {
    this.open = force !== undefined ? force : !this.open;
    $('meta').classList.toggle('open', this.open);
    if (this.open) { this.drawMap(); this.refreshSaves(); }
    return this.open;
  }
}
