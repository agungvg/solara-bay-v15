import { serveDir, launchChrome, newTab } from './cdp.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serveDir(join(root, 'game'));
const chrome = await launchChrome(9232);
try {
  const tab = await newTab(9232, 'about:blank');
  await tab.navigate(`http://127.0.0.1:${port}/index.html?shot=foot&freeze=1`);
  await new Promise(r => setTimeout(r, 8000));
  const res = await tab.evaluate(`(() => {
    const g = window.__game;
    const V3 = g.player.pos.constructor;
    // find the downed group: traverse scene for a group containing a red TorusGeometry ring
    let downed = null;
    g.scene.traverse(o => { if (o.isGroup) o.children.forEach(c => { if (c.geometry && c.geometry.type === 'TorusGeometry') downed = o; }); });
    if (!downed) return { downed: 'NOT FOUND' };
    const p = new V3(); downed.getWorldPosition(p);
    const cam = g.camera;
    const proj = p.clone().project(cam);
    const parts = downed.children.map(c => ({ type: c.geometry ? c.geometry.type : c.type, pos: c.position.toArray().map(v => +v.toFixed(2)), vis: c.visible, mat: c.material && c.material.color ? '#' + c.material.color.getHexString() : null }));
    return { worldPos: p.toArray().map(v => +v.toFixed(1)), visible: downed.visible, screen: [((proj.x * 0.5 + 0.5) * 1280).toFixed(0), ((0.5 - proj.y * 0.5) * 720).toFixed(0)], ndcZ: proj.z.toFixed(2), parts };
  })()`);
  console.log(JSON.stringify(res.value, null, 1));
  tab.close();
} finally { chrome.kill(); server.close(); }
