import { serveDir, launchChrome, newTab } from './cdp.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serveDir(join(root, 'game'));
const chrome = await launchChrome(9225);
try {
  const tab = await newTab(9225, 'about:blank');
  await tab.navigate(`http://127.0.0.1:${port}/index.html?shot=cover&freeze=1`);
  await new Promise(r => setTimeout(r, 9000));
  const res = await tab.evaluate(`(() => {
    const bad = [];
    window.__game.scene.traverse(o => {
      if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
        const a = o.geometry.attributes.position.array;
        for (let i = 0; i < a.length; i++) {
          if (Number.isNaN(a[i])) { bad.push(o.type + ' name=' + (o.name || '') + ' geo=' + o.geometry.type + ' parent=' + (o.parent && o.parent.type)); break; }
        }
      }
    });
    return bad.slice(0, 20);
  })()`);
  console.log('BAD:', JSON.stringify(res.value, null, 1));
  tab.close();
} finally { chrome.kill(); server.close(); }
