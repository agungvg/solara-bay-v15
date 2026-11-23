import { serveDir, launchChrome, newTab } from './cdp.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serveDir(join(root, 'game'));
const chrome = await launchChrome(9230);
try {
  const tab = await newTab(9230, 'about:blank');
  await tab.navigate(`http://127.0.0.1:${port}/index.html?shot=cover&freeze=1`);
  await new Promise(r => setTimeout(r, 8000));
  // Move the camera close to the yacht for a close-up.
  await tab.evaluate(`(() => { const g = window.__game; g.player.setShotCamera([28, 9, 2], [56, 8, -38]); })()`);
  await new Promise(r => setTimeout(r, 600));
  await tab.screenshot('/tmp/yacht-closeup.png');
  console.log('saved /tmp/yacht-closeup.png');
  tab.close();
} finally { chrome.kill(); server.close(); }
