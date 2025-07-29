const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Load environment variables safely
const dotenv = require('dotenv');
const result = dotenv.config();

if (result.error) {
  console.warn('Warning: .env file not found or could not be loaded. Using system environment variables.');
}

// Filter out any problematic environment variables that might be interpreted as routes
const filteredEnv = {};
for (const [key, value] of Object.entries(process.env)) {
  // Skip any environment variables that look like URLs to prevent path-to-regexp errors
  if (!key.endsWith('_URL') && !key.endsWith('_ENDPOINT')) {
    filteredEnv[key] = value;
  }
}
process.env = { ...filteredEnv };

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '/frontend')));

// API routes
const apiRouter = require('./backend/server');
app.use('/api', apiRouter);

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Close server gracefully
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM for graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
