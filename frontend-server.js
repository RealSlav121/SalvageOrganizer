const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, 'frontend')));

// All other GET requests not handled before will return the frontend's index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on http://localhost:${PORT}`);
  console.log('Make sure the backend server is also running on port 5002');
});
