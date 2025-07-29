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
        
        // Make request to Copart public API
        const apiUrl = `https://www.copart.com/public/data/lotdetails/solr/${lotNumber}`;
        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.copart.com/'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch lot data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Check if we have valid data
        if (!data || !data.data || !data.data.lotDetails) {
          throw new Error('Invalid response from Copart API: missing required data');
        }
        
        // Extract relevant data from Copart response
        const lotData = data.data.lotDetails;
        
        // Ensure we have the required nested structure
        if (!lotData.ld) {
          throw new Error('Invalid lot data structure from Copart API');
        }
        
        // Format the response to match frontend expectations
        const formattedData = {
          lotNumber: lotData.ln,
          title: `${lotData.ld.yr} ${lotData.ld.mk} ${lotData.ld.md} #${lotData.ln}`,
          make: lotData.ld.mk,
          model: lotData.ld.md,
          year: lotData.ld.yr,
          damage: lotData.ld.dmg,
          odometer: {
            value: lotData.ld.orr || 0,
            unit: (lotData.ld.oru === 'M' || !lotData.ld.oru) ? 'mi' : 'km',
            formatted: lotData.ld.orr ? `${Number(lotData.ld.orr).toLocaleString()} ${lotData.ld.oru === 'M' ? 'mi' : 'km'}` : 'N/A'
          },
          imageUrl: lotData.ld.thumb ? `https://cs.copart.com/v1/AUTH_svc.pdoc00001${lotData.ld.thumb}` : 'https://via.placeholder.com/300x200',
          saleDate: lotData.ld.saleDate || new Date().toISOString(),
          saleStatus: mapSaleStatus(lotData.ld.saleStatus || 'UPCOMING'),
          saleLocation: lotData.ld.yn || 'ONLINE',
          currentBid: lotData.ld.highestBid || lotData.ld.startingBid || 0,
          buyNowPrice: lotData.ld.buyNowPrice || 0,
          isFavorite: false,
          lastUpdated: new Date().toISOString(),
          vin: lotData.ld.fv || '',
          color: lotData.ld.clr || '',
          engine: lotData.ld.egn || '',
          drive: lotData.ld.drv || '',
          transmission: lotData.ld.tm || '',
          fuelType: lotData.ld.fuel || '',
          bodyStyle: lotData.ld.bstl || '',
          vehicleType: lotData.ld.vt || '',
          primaryDamage: lotData.ld.dmg || '',
          secondaryDamage: lotData.ld.sdmg || '',
          startCode: lotData.ld.stc || '',
          highlights: lotData.ld.hl || '',
          specialNotes: lotData.ld.sn || '',
          seller: 'Copart',
          location: lotData.ld.yn || 'Online',
          hasKeys: lotData.ld.hk || false,
          startPrice: lotData.ld.startingBid || 0,
          bidCount: lotData.ld.bidCount || 0,
          timeLeft: formatTimeLeft(lotData.ld.timeLeft)
        };
        
        console.log('Fetched lot data:', JSON.stringify(formattedData, null, 2));
        
        // Helper function to map sale status
        function mapSaleStatus(status) {
          const statusMap = {
            'UPCOMING': 'FUTURE',
            'PENDING': 'UPCOMING',
            'LIVE': 'NOW_PLAYING',
            'SOLD': 'SOLD',
            'CLOSED': 'SOLD',
            'PROCESSING': 'UPCOMING'
          };
          return statusMap[status] || 'FUTURE';
        }
        
        // Helper function to format time left
        function formatTimeLeft(seconds) {
          if (!seconds) return '';
          const days = Math.floor(seconds / 86400);
          const hours = Math.floor((seconds % 86400) / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          
          const parts = [];
          if (days > 0) parts.push(`${days}d`);
          if (hours > 0) parts.push(`${hours}h`);
          if (minutes > 0) parts.push(`${minutes}m`);
          
          return parts.join(' ') || '0m';
        }
        
        console.log(`Sending response for lot ${lotNumber}`);
        console.log('Response data:', JSON.stringify(mockLotData, null, 2));
        
        // Set CORS headers
        const headers = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        };
        
        // Send a single response
        res.writeHead(200, headers);
        res.end(JSON.stringify(mockLotData));
        console.log('Response sent successfully');
        return; // Important: Return after sending response
      } catch (error) {
        console.error('Error handling API request:', error);
        if (!res.headersSent) {
          res.writeHead(500, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
        return;
      } 
    }
    
    // If no API route matched
    if (!res.headersSent) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
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
