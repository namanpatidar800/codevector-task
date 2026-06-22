require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initSchema } = require('./schema');
const productsRouter = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve the optional UI from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/products', productsRouter);

// Health check — useful for Render's zero-sleep pings
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Boot: ensure tables + indexes exist, then start listening
initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialise schema:', err);
    process.exit(1);
  });
