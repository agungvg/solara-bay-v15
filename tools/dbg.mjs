import { serveDir, launchChrome, newTab } from './cdp.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serveDir(join(root, 'game'));
const chrome = await launchChrome(9224);
try {
  const tab = await newTab(9224, 'about:blank');
  await tab.navigate(`http://127.0.0.1:${port}/index.html?shot=cover&freeze=1`);
  await new Promise(r => setTimeout(r, 9000));
  console.log('errors:', JSON.stringify(await tab.evaluate('window.__errors')));
  console.log('ready:', JSON.stringify(await tab.evaluate('window.__ready')));
  console.log('game:', JSON.stringify(await tab.evaluate('typeof window.__game')));
  for (const e of tab.events) {
    if (e.method === 'Runtime.exceptionThrown') console.log('EXC:', JSON.stringify(e.params).slice(0, 600));
    if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') console.log('CERR:', JSON.stringify(e.params.args).slice(0, 400));
    if (e.method === 'Log.entryAdded') console.log('LOG:', e.params.entry.level, e.params.entry.text?.slice(0, 200), e.params.entry.url || '');
  }
  tab.close();
} finally { chrome.kill(); server.close(); }
