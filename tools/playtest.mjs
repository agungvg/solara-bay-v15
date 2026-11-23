// tools/playtest.mjs — run mission 1 end-to-end with the in-game autopilot.
// Usage: node tools/playtest.mjs
// Opens ?playtest=1 (unfrozen, live sim), drives it with window.__step (the
// harness steps the sim itself: headless Chrome throttles requestAnimationFrame
// to a stop after a few frames, so the live loop cannot drive a playtest),
// waits for window.__playtestDone, prints the result JSON (mission complete?,
// cash, log, errors).
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDir, launchChrome, newTab } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const gameDir = join(root, 'game');

const { server, port } = await serveDir(gameDir);
console.log(`serving game/ on http://127.0.0.1:${port}`);
const chrome = await launchChrome(9223);
console.log('chrome up');
try {
  const url = `http://127.0.0.1:${port}/index.html?playtest=1`;
  const tab = await newTab(9223, url);
  try {
    await tab.navigate(url);
    await tab.waitFor('window.__ready === true', 60000);
    // Hand the sim to the harness: 60 fixed steps (1 sim-second) per call.
    await tab.evaluate('window.__manualDrive = true');
    let done = false;
    for (let i = 0; i < 200 && !done; i++) {
      const r = await tab.evaluate('window.__step(60)');
      done = r.value === true;
    }
    const res = await tab.evaluate('window.__playtest');
    const pageErrs = await tab.evaluate('window.__errors');
    console.log(JSON.stringify({ ...res.value, pageErrors: pageErrs.value, consoleErrors: tab.consoleErrors() }, null, 2));
    if (!done) { console.log('PLAYTEST: not done after 200 sim-seconds'); process.exitCode = 1; }
    else if (!res.value || !res.value.missionComplete) { console.log('PLAYTEST: mission NOT complete'); process.exitCode = 1; }
  } finally {
    tab.close();
  }
} finally {
  chrome.kill();
  server.close();
}
