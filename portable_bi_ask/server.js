const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const BASE_DIR = path.join(__dirname);

const server = http.createServer((req, res) => {
  let filePath = path.join(BASE_DIR, req.url === '/' ? 'index.html' : req.url);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } else {
      const ext = path.extname(filePath);
      const contentType = ext === '.html' ? 'text/html' : 'application/javascript';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});