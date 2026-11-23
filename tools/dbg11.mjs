import { serveDir, launchChrome, newTab } from './cdp.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serveDir(join(root, 'game'));
const chrome = await launchChrome(9234);
try {
  const tab = await newTab(9234, 'about:blank');
  await tab.navigate(`http://127.0.0.1:${port}/index.html?playtest=1`);
  await tab.waitFor('window.__ready === true', 60000);
  await tab.evaluate('window.__manualDrive = true');
  for (let i = 0; i < 6; i++) {
    const t0 = Date.now();
    await tab.evaluate('window.__step(60)');
    const dt = Date.now() - t0;
    const res = await tab.evaluate(`({ pos: [window.__game.player.pos.x.toFixed(1), window.__game.player.pos.z.toFixed(1)], speed: window.__game.player.speed.toFixed(1), stage: window.__game.state.stage })`);
    console.log(`call ${i + 1}: ${dt}ms wall`, JSON.stringify(res.value));
  }
  tab.close();
} finally { chrome.kill(); server.close(); }
