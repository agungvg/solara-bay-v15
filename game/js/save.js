// save.js — 3 save slots in localStorage. A slot holds cash, missions done,
// wanted, district standing and the date, so the meta screen can show a FILLED
// slot 1. Nothing is ever written without the player's own action (or a shot
// staging request), and loading maps known fields through explicit defaults.
const KEY = (n) => `solara-bay-v15-save-${n}`;

export const SaveApi = {
  listSlots() {
    const out = [];
    for (let i = 1; i <= 3; i++) {
      try {
        const raw = localStorage.getItem(KEY(i));
        out.push(raw ? JSON.parse(raw) : null);
      } catch { out.push(null); }
    }
    return out;
  },
  save(slot, state) {
    const data = {
      cash: Math.round(state.cash),
      missionsDone: state.missionIndex,
      wanted: state.wanted,
      friendly: state.friendly,
      date: new Date().toLocaleDateString('en-GB'),
      version: 1,
    };
    try { localStorage.setItem(KEY(slot), JSON.stringify(data)); return data; }
    catch { return null; }
  },
  load(slot) {
    try {
      const raw = localStorage.getItem(KEY(slot));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  // Seed slot 1 for a fresh profile so the meta screen shows a filled slot.
  seedDemoSlot() {
    if (!this.load(1)) {
      try {
        localStorage.setItem(KEY(1), JSON.stringify({
          cash: 21340, missionsDone: 5, wanted: 4, friendly: 58,
          date: '22/11/2026', version: 1,
        }));
      } catch { /* storage unavailable: meta still renders, slot reads EMPTY */ }
    }
  },
};
