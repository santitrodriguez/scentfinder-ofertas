// Servidor local para ver la página: npm run serve  ->  http://localhost:8080
// Sirve site/ y además data/ (igual que queda publicado en GitHub Pages).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = +process.env.PORT || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(p.startsWith('/data/') || p.startsWith('/history/') ? '.' + p : './site' + p);
  if (file.startsWith('..') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('No encontrado'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`ScentFinder en http://localhost:${PORT}`));
