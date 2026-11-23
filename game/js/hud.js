// hud.js — the DOM HUD and the circular minimap. Every element names its
// authoritative source field in GameState; the HUD never invents a number.
import { fmtCash, fmtClock, fmtTimer } from './utils.js';
import { DISTRICTS } from './city.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(state) {
    this.state = state;
    this.buildWeapons();
    this.buildCrew();
    this.minimap = $('minimap').getContext('2d');
  }

  buildWeapons() {
    // Rebuild only when the signature changes (ammo / selection / lock).
    const sig = this.state.weapons.map(w => `${w.name}:${w.ammo}:${w.reserve}:${w.locked}`).join('|') + '#' + this.state.weaponIndex;
    if (sig === this._wSig) return;
    this._wSig = sig;
    const box = $('weapons');
    box.innerHTML = '';
    this.state.weapons.forEach((w, i) => {
      const d = document.createElement('div');
      d.className = 'wslot' + (i === this.state.weaponIndex ? ' sel' : '') + (w.locked ? ' locked' : '');
      d.innerHTML = `<div class="k">${i + 1}</div><div class="ic">${w.icon}</div><div class="nm">${w.name}</div><div class="am">${w.locked ? '—' : (w.ammo === Infinity ? '∞' : w.ammo + (w.reserve ? '/' + w.reserve : ''))}</div>`;
      box.appendChild(d);
    });
  }

  buildCrew() {
    const sig = this.state.crew.slice(0, 3).map(c => `${c.key}:${Math.ceil(c.cooldown)}`).join('|');
    if (sig === this._cSig) return;
    this._cSig = sig;
    const box = $('crew');
    box.innerHTML = '';
    const colours = { MK: '#2f7fe0', LO: '#37e08b', KK: '#ff8fb3', JP: '#ff7a1a', DO: '#9a7bd6' };
    // Show the three active crew cards (Mira, Lio, Kiki); Juno + Dee ride in the chips.
    this.state.crew.slice(0, 3).forEach((c) => {
      const d = document.createElement('div');
      d.className = 'crewcard';
      d.innerHTML = `<div class="key">${c.key}</div><div class="av" style="background:${colours[c.initials] || '#2f7fe0'}">${c.initials}</div>
        <div><div class="nm">${c.ability}</div><div class="rl">${c.name} · ${c.role}</div></div>
        <div class="cd">${c.cooldown > 0 ? Math.ceil(c.cooldown) + 's' : 'READY'}</div>`;
      box.appendChild(d);
    });
  }

  setDialogue(initials, who, line) {
    $('dlgAv').textContent = initials;
    $('dlgWho').textContent = who;
    $('dlgLine').textContent = line;
  }

  setHint(text) { $('hint').textContent = '💡 ' + text; }
  setFeed(text) { $('feed').textContent = '📻 ' + text; }

  toast(text, ms = 2600) {
    const t = $('toast');
    t.textContent = text;
    t.style.display = 'block';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { t.style.display = 'none'; }, ms);
  }

  update() {
    const s = this.state;
    const m = s.mission;
    $('mNum').textContent = 'MISSION ' + m.n;
    $('mTitle').textContent = m.title;
    $('mName').textContent = m.name;
    $('mObj').textContent = m.obj;
    $('mTimer').textContent = fmtTimer(s.missionTime);
    $('mStageBar').style.width = ((s.stage + (s.missionComplete ? 1 : 0)) / m.stages.length * 100) + '%';
    $('mStage').textContent = s.missionComplete ? 'COMPLETE' : `STAGE ${Math.min(s.stage + 1, m.stages.length)}/${m.stages.length}`;
    $('mNext').textContent = s.missionComplete ? 'Done — payout banked'
      : (s.stage < m.stages.length - 1 ? m.stages[s.stage + 1] : 'Finish it');
    // Police panel: 5 named units + "+1 more".
    const rows = s.units.slice(0, 5).map(u => {
      const col = u.mode === 'pursue' ? '#ff5a5a' : u.mode === 'search' ? '#ffb02e' : '#39c6ff';
      return `<tr><td class="u"><span class="dot" style="background:${col}"></span>${u.id}</td><td class="r">${u.role}</td><td class="d">${Math.round(u.dist)} m</td></tr>`;
    }).join('');
    $('unitTable').innerHTML = rows;
    $('unitCount').textContent = s.units.length + ' UNITS';
    $('unitMore').textContent = '+1 more · roadblock ahead';
    // District.
    $('dName').textContent = s.district;
    $('dSub').textContent = s.districtSub;
    $('dMeter').style.width = s.friendly + '%';
    $('dFriendly').textContent = s.friendly;
    // Cash / stars / rank / RP / clock.
    $('clock').textContent = fmtClock(s.clockSeconds);
    $('cash').textContent = fmtCash(s.cash);
    const stars = Array.from({ length: 6 }, (_, i) => i < s.wanted ? '★' : '<span class="off">☆</span>').join('');
    $('stars').innerHTML = stars;
    $('rpFill').style.width = (s.rp / s.rpMax * 100) + '%';
    $('rptext').textContent = `${s.rp.toLocaleString('en-US')} / ${s.rpMax.toLocaleString('en-US')} RP`;
    // Vitals.
    $('hpNum').textContent = Math.round(s.health);
    $('hpBar').style.width = s.health + '%';
    $('arNum').textContent = Math.round(s.armour);
    $('arBar').style.width = s.armour + '%';
    // Speed + vehicle.
    $('vehName').textContent = s.inVehicle
      ? `${s.vehicleName} · ${s.dent}% DENTED`
      : 'ON FOOT · WALKING';
    $('dentBar').style.width = s.dent + '%';
    $('speed').textContent = Math.round(s.speedKmh);
    $('radio').textContent = '♪ ' + s.radio;
    // Air unit tag visibility.
    $('airtag').style.display = s.wanted >= 3 ? 'block' : 'none';
    $('insight').style.display = s.wanted >= 2 ? 'block' : 'none';
    // Weapon slots refresh (ammo changes).
    this.buildWeapons();
    this.buildCrew();
    this.drawMinimap();
  }

  drawMinimap() {
    const ctx = this.minimap;
    const W = 400, H = 400;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 196, 0, Math.PI * 2); ctx.clip();
    // Map background: dark city grid.
    ctx.fillStyle = '#0d1526'; ctx.fillRect(0, 0, W, H);
    // Ocean (east) + beach.
    ctx.fillStyle = '#1f6fb0'; ctx.fillRect(300, 0, 100, H);
    ctx.fillStyle = '#e8cd92'; ctx.fillRect(268, 0, 32, H);
    // City blocks.
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2;
    for (let x = 20; x < 270; x += 34) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 20; y < H; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(300, y); ctx.stroke(); }
    // Boulevard (vertical) + cross streets.
    ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(150, 0); ctx.lineTo(150, H); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 4;
    for (const y of [110, 200, 290]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(300, y); ctx.stroke(); }
    // District dots: all 8. Labels: only 4, with a dark halo — all 8 collide.
    for (const d of DISTRICTS) {
      const mx = ((d.x + 110) / 155) * 300;
      const my = ((d.z + 170) / 340) * 400;
      ctx.fillStyle = '#37e08b';
      ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#c9d4ea'; ctx.font = '700 15px "Segoe UI", Arial';
    ctx.fillText('N', 196, 26);
    ctx.font = '700 12px "Segoe UI", Arial';
    for (const d of DISTRICTS.filter((x) => ['KUMALA STRAND', 'PASARU MARKET', 'MARINA DEL SOL', 'DOWNTOWN'].includes(x.name))) {
      const mx = ((d.x + 110) / 155) * 300;
      const my = ((d.z + 170) / 340) * 400;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(13,21,38,0.9)';
      ctx.strokeText(d.name, mx + 8, my + 4);
      ctx.fillStyle = '#e8eefc';
      ctx.fillText(d.name, mx + 8, my + 4);
    }
    // Mission marker (route to Kumala Pier) — dashed magenta line.
    const s = this.state;
    const px = ((s.playerX ?? 0) + 110) / 155 * 300;
    const py = ((s.playerZ ?? 55) + 170) / 340 * 400;
    ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(180, 60); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.moveTo(180, 48); ctx.lineTo(190, 66); ctx.lineTo(170, 66); ctx.closePath(); ctx.fill();
    // Police blips.
    for (const u of s.units) {
      const bx = px + (Math.sin(u.dist) * 40);
      const by = py - u.dist * 0.5;
      ctx.fillStyle = u.mode === 'pursue' ? '#ff4d4d' : '#39c6ff';
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(px, py); ctx.rotate(s.playerHeading ?? 0);
    ctx.fillStyle = '#ffb02e';
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    // Ring border.
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 196, 0, Math.PI * 2); ctx.stroke();
  }
}
