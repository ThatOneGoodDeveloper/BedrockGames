// Serves this site and a Wisp endpoint at /wisp/ for the Browser tab.
//   npm install && npm start   ->  http://localhost:8080
// Env: PORT, HOST (default 127.0.0.1), ALLOWED_ORIGINS (comma list; default any),
//      ALLOW_PRIVATE=1 lets the proxy reach private/loopback addresses.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { server as wisp, logging } from '@mercuryworkshop/wisp-js/server';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || '127.0.0.1';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const allowPrivate = process.env.ALLOW_PRIVATE === '1';

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
  dns_method: 'lookup',
  dns_result_order: 'ipv4first',
  allow_private_ips: allowPrivate,
  allow_loopback_ips: allowPrivate,
});

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};
const hidden = /(^|\/)(\.|node_modules\/|server\.js$|package(-lock)?\.json$)/;

async function serve(req, res) {
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(root, path));
  if (!file.startsWith(root + sep) || hidden.test(path.slice(1))) { res.writeHead(404).end('Not found'); return; }
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}

const server = createServer(serve);
server.on('upgrade', (req, socket, head) => {
  const path = new URL(req.url, 'http://x').pathname;
  const origin = req.headers.origin;
  if (path !== '/wisp/' && path !== '/wisp') return socket.destroy();
  if (allowedOrigins.length) {
    let sameHost = false;
    try { sameHost = !!origin && new URL(origin).host === req.headers.host; } catch {}
    if (!sameHost && !allowedOrigins.includes(origin)) return socket.destroy();
  }
  wisp.routeRequest(req, socket, head);
});
server.listen(port, host, () => console.log(`Bedrock Games running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));
