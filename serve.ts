// serve.ts — dev server only (not part of the entry): serves game/ on
// http://localhost:8080 so the game can be played in desktop Chrome.
// Node 22 standard library only. Run: node serve.ts
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const path = join(root, url === '/' ? 'index.html' : url);
    if (!existsSync(path) || path.includes('..')) { res.writeHead(404); res.end('not found'); return; }
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
});

server.listen(8080, '127.0.0.1', () => {
  console.log('Solara Bay at http://localhost:8080 — open in desktop Chrome.');
  console.log('Shots: ?shot=cover|foot|chase|meta&freeze=1 · Playtest: ?playtest=1');
});
