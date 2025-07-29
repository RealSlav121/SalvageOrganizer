const http = require('http');
const path = require('path');
const fs = require('fs');

// Remove all environment variables that might cause path-to-regexp issues
Object.keys(process.env).forEach(key => {
  if (key.endsWith('_URL') || key.endsWith('_ENDPOINT')) {
    console.log(`Removing environment variable: ${key}`);
    delete process.env[key];
  }
});

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'frontend');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer(async (req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Handle API routes
  if (req.url.startsWith('/api/')) {
    if (req.method === 'GET' && req.url.startsWith('/api/test')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'API is working!' }));
      return;
    }
    
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
    return;
  }
  
  // Serve static files
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  // Default to index.html for SPA routing
  if (!extname) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
    contentType = 'text/html';
  }

  try {
    const content = await fs.promises.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Page not found, serve index.html for SPA routing
      try {
        const content = await fs.promises.readFile(path.join(PUBLIC_DIR, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content, 'utf-8');
      } catch (err) {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(500);
      res.end(`Server Error: ${error.code}`);
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
