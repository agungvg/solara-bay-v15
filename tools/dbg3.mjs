import { serveDir, launchChrome, newTab } from './cdp.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serveDir(join(root, 'game'));
const chrome = await launchChrome(9226);
try {
  const tab = await newTab(9226, 'about:blank');
  await tab.navigate(`http://127.0.0.1:${port}/index.html?shot=cover&freeze=1`);
  await new Promise(r => setTimeout(r, 9000));
  const res = await tab.evaluate(`(() => {
    const ids = ['app','hud','mission','police','district','mapwrap','minimap','weapons','crew','airtag','speedo','cashbox','chips','dialogue','hintline'];
    const out = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) { out[id] = 'MISSING'; continue; }
      const r = el.getBoundingClientRect();
      out[id] = [Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height)];
    }
    out.viewport = [window.innerWidth, window.innerHeight, document.documentElement.clientHeight, document.body.scrollHeight];
    out.speed = document.getElementById('speed').textContent;
    out.stageBar = document.getElementById('mStageBar').style.width;
    out.next = document.getElementById('mNext').textContent;
    out.stage = document.getElementById('mStage').textContent;
    return out;
  })()`);
  console.log(JSON.stringify(res.value, null, 1));
  tab.close();
} finally { chrome.kill(); server.close(); }
