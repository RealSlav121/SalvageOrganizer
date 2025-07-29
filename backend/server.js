const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Global browser instance and promise
let browser;
let browserPromise;

// Launch browser on startup
async function launchBrowser() {
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-software-rasterizer',
        '--disable-blink-features=AutomationControlled'
      ],
      defaultViewport: {
        width: 1366,
        height: 768,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false
      }
    });
    
    console.log('Browser launched successfully');
    
    // Handle browser disconnection
    browser.on('disconnected', () => {
      console.log('Browser disconnected, restarting...');
      browserPromise = launchBrowser();
    });
    
    return browser;
  } catch (error) {
    console.error('Failed to launch browser:', error);
    throw error;
  }
}

// Initialize browser on startup
browserPromise = launchBrowser().catch(error => {
  console.error('Failed to initialize browser:', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Anti-bot headers
const getHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
  'TE': 'Trailers',
});

// Fetch Copart lot page using Puppeteer
async function fetchLotData(lotNumber) {
  let page;
  try {
    if (!browser) {
      throw new Error('Browser not initialized');
    }

    // Create a new page
    page = await browser.newPage();
    
    // Set up request interception to block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      // Block images, styles, fonts, and other non-essential resources
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
    
    // Set viewport to a common desktop size
    await page.setViewport({ width: 1280, height: 800 });
    
    // Add random delays to mimic human behavior
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Navigate to the page with a random delay
    const url = `https://www.copart.com/lot/${lotNumber}`;
    console.log(`Navigating to ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 // 60 second timeout
    });
    
    // Random delay between 1-3 seconds
    await delay(1000 + Math.random() * 2000);
    
    // Check for CAPTCHA
    const isCaptcha = await page.evaluate(() => {
      return document.body.innerText.includes('captcha') || 
             document.body.innerText.includes('CAPTCHA') ||
             document.body.innerText.includes('Access Denied') ||
             document.body.innerText.includes('access denied');
    });
    
    if (isCaptcha) {
      throw new Error('CAPTCHA or access denied by Copart');
    }
    
    // Get the page content
    const content = await page.content();
    return content;
    
  } catch (error) {
    console.error('Error fetching lot data with Puppeteer:', error);
    throw new Error('Failed to fetch lot data: ' + error.message);
  } finally {
    // Close the page to free up resources
    if (page && !page.isClosed()) {
      await page.close().catch(console.error);
    }
  }
}

// Extract lot data from HTML
const extractLotData = (html) => {
  try {
    const $ = cheerio.load(html);
    
    // Check for Future status in the HTML
    const futureSaleElement = $('a[data-uname="lotdetailFuturelink"]');
    const isFutureSale = futureSaleElement.length > 0 && futureSaleElement.text().trim() === 'Future';
    
    // Try to find the JSON data in the page
    const scriptContent = $('script').filter((_, el) => {
      const content = $(el).html() || '';
      return content.includes('cachedSolrLotDetailsStr');
    }).first().html() || '';
    
    // Extract the JSON string
    const jsonMatch = scriptContent.match(/cachedSolrLotDetailsStr:\s*"({.+?})"/);
    if (!jsonMatch) {
      console.error('Could not find cachedSolrLotDetailsStr in HTML');
      return null;
    }
    
    // Unescape the JSON string and parse it
    const jsonStr = jsonMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const lotData = JSON.parse(jsonStr);
    
    // Parse auction date from HTML if available
    const auctionDateElement = $('span[data-uname="lotdetailSaleinformationsaledatevalue"]').first();
    let auctionDate = null;
    
    if (auctionDateElement.length > 0) {
      const dateText = auctionDateElement.text().trim();
      // Try to parse the date from the format: "Wed. Jul 30, 2025 10:00 AM EDT"
      const dateMatch = dateText.match(/([A-Za-z]+)\.?\s+([A-Za-z]+)\s+(\d+),\s*(\d+)\s+(\d+:\d+\s*[AP]M)/);
      if (dateMatch) {
        const [_, day, month, date, year, time] = dateMatch;
        const dateStr = `${month} ${date}, ${year} ${time}`;
        auctionDate = new Date(dateStr);
      }
    }
    
    // Check for "Upcoming lot" status in the HTML
    const isUpcomingLot = $('a:contains("Upcoming lot")').filter((i, el) => {
      return $(el).text().trim() === 'Upcoming lot';
    }).length > 0;
    
    // Determine sale status and date
    let saleStatus;
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000; // One day in milliseconds
    
    // Check if the lot is sold (look for sold indicators in the HTML)
    const isSold = $('span:contains("Sold"), div:contains("Sold")').filter((i, el) => {
      return $(el).text().trim() === 'Sold';
    }).length > 0;
    
    // 1. First check if the lot is sold
    if (isSold) {
      saleStatus = 'SOLD';
    }
    // 2. Then check if the auction date is in the past
    else if (auctionDate && auctionDate < now) {
      saleStatus = 'SOLD';
    }
    // 3. Then check if the auction date is today (ignoring time)
    else if (auctionDate && 
             auctionDate.getFullYear() === now.getFullYear() &&
             auctionDate.getMonth() === now.getMonth() &&
             auctionDate.getDate() === now.getDate()) {
      saleStatus = 'NOW_PLAYING';
    }
    // 4. If there's any auction date, it's "Soon Playing"
    else if (auctionDate) {
      saleStatus = 'SOON_PLAYING';
    }
    // 5. Check if it's explicitly marked as "Upcoming lot" in the HTML
    else if (isUpcomingLot) {
      saleStatus = 'UPCOMING';
    }
    // 6. Default status for any other case (no sale date)
    else {
      // If we have a future sale date, it should be SOON_PLAYING, not FUTURE
      if (isFutureSale && lotData.ad) {
        saleStatus = 'SOON_PLAYING';
      } else {
        saleStatus = isFutureSale ? 'FUTURE' : getSaleStatus(lotData.ss, lotData.ad);
      }
    }
    
    const saleDate = (saleStatus === 'FUTURE' || !lotData.ad) ? null : new Date(lotData.ad).toISOString();
    
    // Check if odometer reading is available
    const hasOdometer = lotData.ord && lotData.ord.trim() !== '' && lotData.orr;
    
    // Extract the data we need
    const result = {
      lotNumber: lotData.lotNumberStr || lotData.ln?.toString(),
      title: lotData.ld?.trim(),
      year: lotData.lcy,
      make: lotData.mkn,
      model: lotData.lm || lotData.mmod,
      odometer: hasOdometer ? {
        value: lotData.orr,
        unit: lotData.ord === 'ACTUAL' ? 'mi' : 'km'
      } : null,
      primaryDamage: lotData.dd,
      vin: lotData.fv,
      saleDate: saleDate,
      saleStatus: saleStatus,
      imageUrl: lotData.tims ? lotData.tims.replace('_thb.', '_ful.') : null,
      location: lotData.yn,
      currentBid: lotData.hb,
      buyItNow: lotData.myb > 0 ? lotData.myb : null,
      hasBuyNow: lotData.myb > 0,
      vehicleType: lotData.vehTypDesc,
      drive: lotData.drv,
      fuelType: lotData.ft,
      color: lotData.clr,
      titleStatus: lotData.tgd,
      titleType: lotData.td,
      keys: lotData.hk === 'YES',
      startCode: lotData.lcd,
      startCodeDescription: lotData.lcd,
      highlights: lotData.lfd || [],
      saleStatusDescription: getSaleStatusDescription(lotData.ss, lotData.ad),
      saleTime: lotData.at,
      timeZone: lotData.ianaTimeZone || 'America/New_York'
    };
    
    return result;
  } catch (error) {
    console.error('Error parsing lot data:', error);
    return null;
  }
};

// Helper function to determine sale status
getSaleStatus = (statusCode, saleDate) => {
  if (!saleDate) return 'FUTURE';
  
  const now = new Date();
  const saleDateTime = new Date(saleDate);
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(now.getDate() - 5);
  
  // If sale is in the future
  if (now < saleDateTime) {
    // If it's scheduled with a date, it's UPCOMING
    if (statusCode === 2 || statusCode === 3) return 'UPCOMING';
    // If it's a future auction (not yet scheduled or in planning)
    if (statusCode === 0 || statusCode === 1) return 'FUTURE';
    // Default for future with unknown status code
    return 'UPCOMING';
  }
  
  // If sale is in the past
  if (saleDateTime > fiveDaysAgo) {
    return 'SOLD_RECENTLY';
  }
  
  // If we have a date but it's not in the future or recent past, it's likely a past auction
  return 'SOLD';
};

// Helper function to get sale status description
const getSaleStatusDescription = (statusCode, saleDate) => {
  const status = getSaleStatus(statusCode, saleDate);
  
  const descriptions = {
    'WITH_AUCTION_DATE': 'Auction Scheduled',
    'FUTURE': 'Future',
    'UPCOMING': 'Upcoming',
    'SOLD_RECENTLY': 'Recently Sold',
    'SOLD': 'Sold',
    'SOON_PLAYING': 'Soon Playing',
    'NOW_PLAYING': 'Now Playing',
    'LIVE': 'Live Now',
    'UNKNOWN': 'Status Unknown'
  };
  
  return descriptions[status] || 'Unknown';
};

// API endpoint to fetch lot data
app.get('/lot/:lotNumber', async (req, res) => {
  let page = null;
  // ... (rest of the code remains the same)
  try {
    const { lotNumber } = req.params;
    
    if (!lotNumber) {
      return res.status(400).json({ error: 'Lot number is required' });
    }
    
    // Construct the URL
    const url = `https://www.copart.com/lot/${lotNumber}`;
    console.log(`Attempting to fetch: ${url}`);
    
    // Get browser instance
    const browser = await browserPromise;
    if (!browser) {
      throw new Error('Browser instance not available');
    }
    
    // Create a new page with basic settings
    page = await browser.newPage();
    
    // Set a basic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set basic headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive'
    });
    
    console.log(`Navigating to ${url}...`);
    
    // Simple navigation without request interception
    const response = await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    
    if (!response) {
      throw new Error('No response received from the server');
    }
    
    const status = response.status();
    console.log(`Page loaded with status: ${status}`);
    
    if (status >= 400) {
      throw new Error(`Failed to load page: HTTP ${status}`);
    }
    
    // Wait for the main content
    console.log('Waiting for content to load...');
    await page.waitForSelector('body', { timeout: 15000 });
    
    // Get the page content
    console.log('Getting page content...');
    const html = await page.content();
    console.log(`Received ${html.length} characters of HTML`);
    
    // Extract and parse the data
    const lotData = extractLotData(html);
    
    if (!lotData) {
      return res.status(404).json({ error: 'Could not extract lot data' });
    }
    
    // Close the page when done
    await page.close();
    page = null;
    
    return res.json(lotData);
    
  } catch (error) {
    console.error('Error fetching lot data:', error.message);
    
    // Close the page if it exists
    if (page) {
      try {
        await page.close();
      } catch (e) {
        console.error('Error closing page:', e.message);
      }
    }
    
    // Handle specific Puppeteer errors
    if (error.message.includes('Navigation timeout') || error.message.includes('TimeoutError')) {
      return res.status(504).json({ 
        error: 'Request to Copart timed out',
        details: 'The request took too long to complete.'
      });
    } else if (error.message.includes('net::ERR_CONNECTION_REFUSED') || 
               error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      return res.status(502).json({ 
        error: 'Unable to connect to Copart',
        details: 'The server could not be reached.'
      });
    } else if (error.message.includes('Access denied') || 
              error.message.includes('403') || 
              error.message.includes('blocked')) {
      return res.status(403).json({ 
        error: 'Access denied',
        details: 'Copart might be blocking this request. Try using a proxy or rotating user agents.'
      });
    } else if (error.message.includes('404')) {
      return res.status(404).json({ 
        error: 'Lot not found',
        details: 'The specified lot number could not be found on Copart.'
      });
    } else {
      // Generic error response
      return res.status(500).json({ 
        error: 'Error processing request',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/lot/:lotNumber`);
});

module.exports = app;
