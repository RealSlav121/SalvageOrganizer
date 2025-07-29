const express = require('express');
const path = require('path');

// Create a new Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '/frontend')));

// Simple test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route working!' });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Minimal server running on port ${PORT}`);
});
