const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// POST /api/auth/signup  { username, password }
router.post('/signup', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Choose a display name.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const cleanUsername = username.trim().slice(0, 24);
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
  if (existing) {
    return res.status(409).json({ error: 'That name is already taken.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)'
  ).run(cleanUsername, passwordHash, Date.now());

  const user = { id: info.lastInsertRowid, username: cleanUsername };
  const token = signToken(user);
  res.status(201).json({ token, user });
});

// POST /api/auth/login  { username, password }
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  const user = { id: row.id, username: row.username };
  const token = signToken(user);
  res.json({ token, user });
});

// GET /api/auth/me  (requires Authorization header)
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
