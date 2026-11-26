// A tiny static server for playing the game locally:
//   node serve.ts   →   http://localhost:8080
// Serves game/ exactly as a static host would; no build step, no network.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = normalize(join(root, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!path.startsWith(root) || !existsSync(path) || statSync(path).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
}).listen(8080, () => console.log('Senja Hopper at http://localhost:8080'));
