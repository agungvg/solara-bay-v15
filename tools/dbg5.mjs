import { serveDir, launchChrome, newTab } from './cdp.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serveDir(join(root, 'game'));
const chrome = await launchChrome(9228);
try {
  const tab = await newTab(9228, 'about:blank');
  await tab.navigate(`http://127.0.0.1:${port}/index.html?shot=cover&freeze=1`);
  await new Promise(r => setTimeout(r, 9000));
  const res = await tab.evaluate(`(() => {
    const g = window.__game;
    const V3 = g.player.pos.constructor;
    const y = g.city.yacht;
    const p = new V3();
    y.getWorldPosition(p);
    const cam = g.camera;
    const proj = p.clone().project(cam);
    const sailTop = new V3(p.x + 6, 19, p.z).project(cam);
    const rc = new (Object.getPrototypeOf(cam).constructor)();
    return { err: 'skip-raycast' };
  })()`);
  console.log('probe1:', JSON.stringify(res));
  const res2 = await tab.evaluate(`(() => {
    const g = window.__game;
    const V3 = g.player.pos.constructor;
    const y = g.city.yacht;
    const p = new V3();
    y.getWorldPosition(p);
    const cam = g.camera;
    const proj = p.clone().project(cam);
    const sailTop = new V3(p.x + 6, 19, p.z).project(cam);
    return {
      yachtWorld: p.toArray().map(v => +v.toFixed(1)),
      ndc: [proj.x.toFixed(2), proj.y.toFixed(2)],
      screen: [((proj.x * 0.5 + 0.5) * 1280).toFixed(0), ((0.5 - proj.y * 0.5) * 720).toFixed(0)],
      sailTopScreen: [((sailTop.x * 0.5 + 0.5) * 1280).toFixed(0), ((0.5 - sailTop.y * 0.5) * 720).toFixed(0)],
      distToYacht: g.player.camPos.distanceTo(p).toFixed(1),
      camFov: cam.fov,
    };
  })()`);
  console.log('probe2:', JSON.stringify(res2.value, null, 1));
  tab.close();
} finally { chrome.kill(); server.close(); }
