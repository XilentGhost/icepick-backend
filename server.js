require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET. Copy .env.example to .env and set one before starting the server.');
  process.exit(1);
}

const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const presence = new Map();
const PRESENCE_WINDOW_MS = 90 * 1000;
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.post('/api/presence/ping', (req, res) => {
  const { deviceId } = req.body || {};
  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ error: 'deviceId required' });
  }
  presence.set(deviceId, Date.now());
  res.json({ ok: true });
});

app.get('/api/presence/count', (req, res) => {
  const now = Date.now();
  let count = 0;
  for (const [id, ts] of presence) {
    if (now - ts <= PRESENCE_WINDOW_MS) count++;
    else presence.delete(id);
  }
  res.json({ count });
});

// Fallback error handler (e.g. multer file-size / file-type errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Something went wrong.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Ice Pick API running on http://localhost:${port}`);
});
