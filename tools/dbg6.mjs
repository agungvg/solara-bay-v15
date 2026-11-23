import { serveDir, launchChrome, newTab } from './cdp.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serveDir(join(root, 'game'));
const chrome = await launchChrome(9229);
try {
  const tab = await newTab(9229, 'about:blank');
  await tab.navigate(`http://127.0.0.1:${port}/index.html?shot=cover&freeze=1`);
  await new Promise(r => setTimeout(r, 9000));
  const res = await tab.evaluate(`(() => {
    const g = window.__game;
    const V3 = g.player.pos.constructor;
    const y = g.city.yacht;
    const out = [];
    const p = new V3();
    y.children.forEach((c, i) => {
      c.getWorldPosition(p);
      out.push({ i, type: c.geometry ? c.geometry.type : c.type, pos: p.toArray().map(v => +v.toFixed(1)), visible: c.visible, mat: c.material ? (c.material.color ? '#' + c.material.color.getHexString() : c.material.type) : null, scale: c.scale ? c.scale.toArray().map(v => +v.toFixed(2)) : null });
    });
    return out;
  })()`);
  console.log(JSON.stringify(res.value, null, 1));
  tab.close();
} finally { chrome.kill(); server.close(); }
