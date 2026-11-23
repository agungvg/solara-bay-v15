// tools/cdp.mjs — minimal pure-Node Chrome DevTools driver (no dependencies).
// Launches the Playwright-cached Chromium headless, serves a directory over
// HTTP, opens a page, waits for a JS condition, captures screenshots and
// collects console errors / exceptions. Node 22+ (global WebSocket, fetch).
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

export const CHROME = process.env.CHROME
  || `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

export function serveDir(root, port = 0) {
  const server = createServer(async (req, res) => {
    try {
      const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let path = join(root, url === '/' ? 'index.html' : url);
      if (!existsSync(path) || path.includes('..')) { res.writeHead(404); res.end('nf'); return; }
      const data = await readFile(path);
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ server, port: server.address().port })));
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export async function launchChrome(port = 9222) {
  const args = [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    '--window-size=1280,720', '--hide-scrollbars', '--mute-audio',
    `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
    'about:blank',
  ];
  const proc = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  // Wait for the DevTools HTTP endpoint.
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return proc;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  proc.kill();
  throw new Error('chrome DevTools endpoint never came up');
}

export class Tab {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { ok, err } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) err(new Error(JSON.stringify(msg.error)));
        else ok(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
  }
  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((ok, err) => { this.ws.onopen = ok; this.ws.onerror = err; });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((ok, err) => {
      this.pending.set(id, { ok, err });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { error: r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails) };
    return { value: r.result?.value };
  }
  async navigate(url) {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Log.enable');
    // Force the dossier viewport: headless --window-size leaves the layout
    // viewport short (577px tall for a 720 window), which misplaces every
    // bottom-anchored HUD element. Override to a true 1280x720.
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
    });
    await this.send('Page.navigate', { url });
  }
  async waitFor(expression, timeoutMs = 60000, pollMs = 250) {
    const t0 = Date.now();
    for (;;) {
      const r = await this.evaluate(expression);
      if (r.value === true) return true;
      if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for: ${expression}`);
      await sleep(pollMs);
    }
  }
  async screenshot(path) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, Buffer.from(r.data, 'base64'));
  }
  consoleErrors() {
    const out = [];
    for (const e of this.events) {
      if (e.method === 'Runtime.exceptionThrown') {
        out.push('exception: ' + (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text));
      } else if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') {
        out.push('console.error: ' + e.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      } else if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') {
        out.push('log.error: ' + e.params.entry.text + ' ' + (e.params.entry.url || ''));
      }
    }
    return out;
  }
  close() { try { this.ws.close(); } catch { /* already closed */ } }
}

export async function newTab(port = 9222, url = 'about:blank') {
  const r = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const target = await r.json();
  const tab = new Tab(target.webSocketDebuggerUrl);
  await tab.open();
  return tab;
}

export async function closeTab(port, targetId) {
  try { await fetch(`http://127.0.0.1:${port}/json/close/${targetId}`); } catch { /* ignore */ }
}
