import { serveDir, launchChrome, newTab } from './cdp.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serveDir(join(root, 'game'));
const chrome = await launchChrome(9231);
try {
  const tab = await newTab(9231, 'about:blank');
  await tab.navigate(`http://127.0.0.1:${port}/index.html?shot=cover&freeze=1`);
  await new Promise(r => setTimeout(r, 8000));
  const res = await tab.evaluate(`(() => {
    const g = window.__game;
    const V3 = g.player.pos.constructor;
    const y = g.city.yacht;
    const cam = g.camera;
    const proj = (v) => { const p = v.clone().project(cam); return [((p.x * 0.5 + 0.5) * 1280).toFixed(0), ((0.5 - p.y * 0.5) * 720).toFixed(0)]; };
    const sail = y.children[5]; // main sail
    const sail2 = y.children[6];
    const corners = [];
    // sail local corners: width 9 (x -4.5..4.5), height 15 (y -7.5..7.5), at local pos (6.2, 11.5, 0)
    for (const [lx, ly] of [[-4.5, -7.5], [4.5, -7.5], [4.5, 7.5], [-4.5, 7.5]]) {
      const w = new V3(lx, ly, 0);
      sail.localToWorld(w);
      corners.push(proj(w));
    }
    const mast = y.children[4];
    const mp = new V3(); mast.getWorldPosition(mp);
    return { sailCorners: corners, sailWorldPos: sail.getWorldPosition(new V3()).toArray().map(v => +v.toFixed(1)), mastPos: mp.toArray().map(v => +v.toFixed(1)), yachtRotY: y.rotation.y.toFixed(2) };
  })()`);
  console.log(JSON.stringify(res.value, null, 1));
  tab.close();
} finally { chrome.kill(); server.close(); }
