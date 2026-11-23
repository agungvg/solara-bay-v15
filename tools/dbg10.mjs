import { serveDir, launchChrome, newTab } from './cdp.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serveDir(join(root, 'game'));
const chrome = await launchChrome(9233);
try {
  const tab = await newTab(9233, 'about:blank');
  await tab.navigate(`http://127.0.0.1:${port}/index.html?playtest=1`);
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await tab.evaluate(`(() => {
      const g = window.__game;
      return {
        ready: window.__ready, done: window.__playtestDone,
        errors: window.__errors,
        pos: g ? [g.player.pos.x.toFixed(1), g.player.pos.z.toFixed(1)] : null,
        speed: g ? g.player.speed.toFixed(1) : null,
        heading: g ? g.player.heading.toFixed(2) : null,
        autopilot: g && g.player.autopilot ? { x: g.player.autopilot.x, z: g.player.autopilot.z, arrived: g.player.autopilot.arrived } : null,
        mode: g ? g.player.mode : null,
        stage: g ? g.state.stage : null,
        missionComplete: g ? g.state.missionComplete : null,
        cash: g ? g.state.cash : null,
        frames: window.__frames,
        fps: window.__fps,
      };
    })()`);
    console.log(`t=${(i + 1) * 5}s`, JSON.stringify(res.value));
    if (res.value && res.value.done) break;
  }
  tab.close();
} finally { chrome.kill(); server.close(); }
