import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

const PORT = 3000;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url || '', true);
  let pathname = parsedUrl.pathname || '/';

  // Default to index.html for root path
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // Security: prevent directory traversal
  if (pathname.includes('..')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const filePath = path.join(__dirname, '..', 'public', pathname);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Internal server error');
      }
      return;
    }

    // Set content type based on file extension
    const ext = path.extname(filePath);
    let contentType = 'text/plain';

    switch (ext) {
      case '.html':
        contentType = 'text/html';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.js':
        contentType = 'application/javascript';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Pure TypeScript server running at http://localhost:${PORT}`);
});