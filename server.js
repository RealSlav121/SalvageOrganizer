// Simple HTTP server to serve static files
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Configuration
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'frontend');

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.woff2': 'application/font-woff2',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

// Helper function to serve a file
function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found, serve index.html for SPA routing
        if (contentType === 'text/html') {
          serve404(res);
        } else {
          serveIndexHtml(res);
        }
      } else {
        // Server error
        res.writeHead(500);
        res.end('Server Error: ' + error.code);
      }
    } else {
      // File found, serve it
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

// Serve 404 page
function serve404(res) {
  const notFoundPath = path.join(PUBLIC_DIR, '404.html');
  fs.readFile(notFoundPath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(content, 'utf-8');
    }
  });
}

// Serve index.html for SPA routing
function serveIndexHtml(res) {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  fs.readFile(indexPath, (error, content) => {
    if (error) {
      serve404(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content, 'utf-8');
    }
  });
}

// API Routes
const handleApiRequest = async (req, res) => {
  console.log('Handling API request:', req.url);
  
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    console.log('Path segments:', pathSegments);
    
    // Handle /api/lot/:lotNumber
    if (pathSegments[0] === 'api' && pathSegments[1] === 'lot' && pathSegments[2]) {
      const lotNumber = pathSegments[2];
      
      try {
        console.log(`Fetching data for lot ${lotNumber}`);
        // In a real implementation, you would fetch the lot data from your database or Copart API
        // For now, we'll return mock data with the structure expected by the frontend
        // Generate a random sale date within the next 14 days
        const randomDays = Math.floor(Math.random() * 14);
        const saleDate = new Date();
        saleDate.setDate(saleDate.getDate() + randomDays);
        
        // Determine sale status based on the date
        let saleStatus = 'FUTURE';
        if (randomDays === 0) saleStatus = 'NOW_PLAYING';
        else if (randomDays <= 7) saleStatus = 'SOON_PLAYING';
        
        const mockLotData = {
          lotNumber,
          title: `2020 Tesla Model 3 #${lotNumber}`,
          make: 'Tesla',
          model: 'Model 3',
          year: '2020',
          damage: 'Front End',
          odometer: {
            value: 12345,
            unit: 'mi',
            formatted: '12,345 mi'
          },
          imageUrl: 'https://via.placeholder.com/300x200',
          saleDate: saleDate.toISOString(),
          saleStatus,
          saleLocation: 'ONLINE',
          currentBid: 25000,
          buyNowPrice: 30000,
          isFavorite: false,
          lastUpdated: new Date().toISOString(),
          // Additional fields
          vin: `5YJ3E1EA${lotNumber.slice(-9)}`,
          color: 'Red',
          engine: 'Electric',
          drive: 'AWD',
          transmission: 'Automatic',
          fuelType: 'Electric',
          bodyStyle: 'Sedan',
          vehicleType: 'Passenger Vehicle',
          primaryDamage: 'Front End',
          secondaryDamage: 'None',
          startCode: 'A',
          highlights: 'Clean Title, Runs and Drives',
          specialNotes: 'Airbags Deployed, Starts',
          // Add more fields that might be used by the frontend
          seller: 'Copart',
          location: 'Online',
          hasKeys: true,
          startPrice: 10000,
          bidCount: Math.floor(Math.random() * 50),
          timeLeft: '2d 4h 30m'
        };
        
        console.log(`Sending response for lot ${lotNumber}`);
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(JSON.stringify(mockLotData));
        return;
      } catch (error) {
        console.error('Error handling API request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
        return;
      }
    }
    
    // If no API route matched
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (error) {
    console.error('Error processing request:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Error processing request' }));
  }
};

// Create server
const server = http.createServer((req, res) => {
  const requestTime = new Date().toISOString();
  console.log(`[${requestTime}] ${req.method} ${req.url}`);
  
  // Log request headers for debugging
  if (req.url.startsWith('/api/')) {
    console.log('API Request Headers:', JSON.stringify(req.headers, null, 2));
    
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    handleApiRequest(req, res);
    return;
  }
  
  // Parse URL for static file serving
  const parsedUrl = url.parse(req.url);
  let pathname = path.join(PUBLIC_DIR, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
  
  // Get file extension and content type
  const ext = path.extname(pathname);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  // If no extension, assume it's a route and serve index.html
  if (!ext) {
    serveIndexHtml(res);
    return;
  }
  
  // Serve the file
  serveFile(res, pathname, contentType);
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Serving files from: ${PUBLIC_DIR}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  server.close(() => {
    process.exit(1);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
