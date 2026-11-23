import { serveDir, launchChrome, newTab } from './cdp.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serveDir(join(root, 'game'));
const chrome = await launchChrome(9227);
try {
  const tab = await newTab(9227, 'about:blank');
  await tab.navigate(`http://127.0.0.1:${port}/index.html?shot=cover&freeze=1`);
  await new Promise(r => setTimeout(r, 9000));
  const res = await tab.evaluate(`(() => {
    const g = window.__game;
    const v = new (Object.getPrototypeOf(g.scene).constructor)();
    const cam = g.scene.children.find(o => false);
    // project using the game's camera via a stored reference: use renderer size + camera from __game? camera is not exposed; rebuild from player camPos/camTarget
    const THREE = window.__THREE__;
    return 'need camera';
  })()`);
  // Simpler: expose camera via __game in main.js is not done; use the scene's active camera through renderer? Instead, compute projection manually:
  const res2 = await tab.evaluate(`(() => {
    const g = window.__game;
    // find yacht: traverse for the group whose first child is an ExtrudeGeometry hull
    let yacht = null;
    g.scene.traverse(o => { if (o.isGroup && o.children.length > 5 && o.children[0] && o.children[0].geometry && o.children[0].geometry.type === 'ExtrudeGeometry') yacht = o; });
    if (!yacht) return { yacht: 'NOT FOUND' };
    const p = yacht.position;
    // camera pose from player
    const camPos = g.player.camPos, camTgt = g.player.camTarget;
    return { yachtPos: [p.x.toFixed(1), p.y.toFixed(1), p.z.toFixed(1)], camPos: [camPos.x, camPos.y, camPos.z], camTgt: [camTgt.x, camTgt.y, camTgt.z], children: yacht.children.length };
  })()`);
  console.log(JSON.stringify(res2.value, null, 1));
  tab.close();
} finally { chrome.kill(); server.close(); }
