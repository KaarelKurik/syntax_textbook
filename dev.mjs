// Live preview: rebuilds with --drafts whenever src/ or build.mjs changes, serves dist/,
// and tells open pages to reload after each rebuild.
//
// Usage: npm run dev   (then open http://localhost:8000)

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8000;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
};
const RELOAD = `<script>new EventSource('/__reload').onmessage = () => location.reload();</script>`;

const clients = new Set();

function build() {
  const t = Date.now();
  const r = spawnSync(process.execPath, [path.join(ROOT, 'build.mjs'), '--drafts'], { encoding: 'utf8' });
  process.stdout.write(`\n[${new Date().toLocaleTimeString()}] ${r.stdout}${r.stderr}`);
  console.log(`(${Date.now() - t} ms)`);
  for (const res of clients) res.write('data: reload\n\n');
}

let timer = null;
const schedule = () => { clearTimeout(timer); timer = setTimeout(build, 100); };
fs.watch(path.join(ROOT, 'src'), { recursive: true }, schedule);
fs.watch(path.join(ROOT, 'build.mjs'), schedule);

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  const file = path.join(DIST, url.endsWith('/') ? url + 'index.html' : url);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  const ext = path.extname(file);
  let body = fs.readFileSync(file);
  if (ext === '.html') body = body.toString().replace('</body>', `${RELOAD}\n</body>`);
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(body);
}).listen(PORT, () => {
  build();
  console.log(`Preview at http://localhost:${PORT}`);
});
