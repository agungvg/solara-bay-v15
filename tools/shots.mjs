// tools/shots.mjs — take the 4 dossier screenshots (1280x720 PNG, 0 errors).
// Usage: node tools/shots.mjs [cover|foot|chase|meta ...]  (default: all four)
// Serves game/ on localhost, opens each ?shot= URL frozen, waits for
// window.__ready, screenshots to screenshots/<n>-<shot>.png.
import { mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDir, launchChrome, newTab } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const gameDir = join(root, 'game');
const outDir = join(root, 'screenshots');
mkdirSync(outDir, { recursive: true });

const SHOTS = process.argv.slice(2).length ? process.argv.slice(2) : ['cover', 'foot', 'chase', 'meta'];
const NAMES = { cover: '1-cover.png', foot: '2-foot.png', chase: '3-chase.png', meta: '4-meta.png' };

const { server, port } = await serveDir(gameDir);
console.log(`serving game/ on http://127.0.0.1:${port}`);
const chrome = await launchChrome(9222);
console.log('chrome up');

const results = [];
try {
  for (const shot of SHOTS) {
    const url = `http://127.0.0.1:${port}/index.html?shot=${shot}&freeze=1`;
    const tab = await newTab(9222, url);
    try {
      await tab.navigate(url);
      await tab.waitFor('window.__ready === true', 60000);
      // One extra beat so the HUD DOM settles.
      await new Promise((r) => setTimeout(r, 400));
      const errs = [...(await tab.evaluate('window.__errors')).value, ...tab.consoleErrors()];
      const out = join(outDir, NAMES[shot]);
      await tab.screenshot(out);
      const size = statSync(out).size;
      const webgl = await tab.evaluate('(() => { const c = document.createElement("canvas"); const gl = c.getContext("webgl2") || c.getContext("webgl"); return gl ? gl.getParameter(gl.VERSION) : "NO WEBGL"; })()');
      results.push({ shot, file: NAMES[shot], size, errors: errs, webgl: webgl.value });
      console.log(`${shot}: ${NAMES[shot]} ${size} bytes, errors=${errs.length}, webgl=${webgl.value}`);
      for (const e of errs) console.log('  ERR: ' + e);
    } finally {
      tab.close();
    }
  }
} finally {
  chrome.kill();
  server.close();
}

const bad = results.filter((r) => r.errors.length || r.size > 262144);
console.log(bad.length ? `FAIL: ${bad.length} shot(s) with errors or oversize` : 'ALL SHOTS OK (0 errors, all <= 256 KiB)');
process.exit(bad.length ? 1 : 0);
