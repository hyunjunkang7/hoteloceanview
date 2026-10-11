// Tiny static server for local preview: node serve.js [dir] [port]
const http = require('http');
const fs = require('fs');
const path = require('path');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '../site'));
const port = Number(process.argv[3] || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(dir, p);
  if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data);
  });
}).listen(port, () => console.log(`Serving ${dir} at http://localhost:${port}`));
