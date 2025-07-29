const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');

// Completely clear any problematic environment variables
Object.keys(process.env).forEach(key => {
  if (key.endsWith('_URL') || key.endsWith('_ENDPOINT') || key === 'DEBUG_URL') {
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

// Simple file server
function serveStaticFile(res, filePath, contentType) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        serve404(res);
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

function serve404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
}

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Parse URL
  const parsedUrl = url.parse(req.url, true);
  let pathname = path.join(PUBLIC_DIR, parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname);
  
  // Default to index.html for SPA routing
  if (!path.extname(pathname)) {
    pathname = path.join(PUBLIC_DIR, 'index.html');
  }
  
  const ext = path.extname(pathname);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  // Serve static files
  serveStaticFile(res, pathname, contentType);
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log('Serving static files from:', PUBLIC_DIR);
});

// Handle errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});
