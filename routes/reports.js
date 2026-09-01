const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_CATEGORIES = ['caution', 'active', 'suspicious', 'police', 'safe'];
const ALLOWED_SEVERITIES = ['low', 'medium', 'high'];

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, crypto.randomUUID() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  }
});

function reportToJSON(row, commentCount) {
  return {
    id: row.id,
    author: row.username,
    cat: row.category,
    title: row.title,
    desc: row.description,
    loc: row.location,
    sev: row.severity,
    x: row.pos_x,
    y: row.pos_y,
    photo: row.photo_path ? `/uploads/${row.photo_path}` : null,
    ts: row.created_at,
    commentCount: commentCount || 0
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT reports.*, users.username,
      (SELECT COUNT(*) FROM comments WHERE comments.report_id = reports.id) AS comment_count
    FROM reports
    JOIN users ON users.id = reports.user_id
    ORDER BY reports.created_at DESC
  `).all();

  res.json(rows.map(r => reportToJSON(r, r.comment_count)));
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT reports.*, users.username
    FROM reports JOIN users ON users.id = reports.user_id
    WHERE reports.id = ?
  `).get(req.params.id);

  if (!row) return res.status(404).json({ error: 'Report not found.' });

  const comments = db.prepare(`
    SELECT comments.*, users.username
    FROM comments JOIN users ON users.id = comments.user_id
    WHERE report_id = ?
    ORDER BY comments.created_at ASC
  `).all(req.params.id);

  res.json({
    ...reportToJSON(row),
    comments: comments.map(c => ({
      id: c.id,
      author: c.username,
      text: c.text,
      ts: c.created_at
    }))
  });
});

router.post('/', requireAuth, upload.single('photo'), (req, res) => {
  const { cat, title, desc, loc, sev, x, y } = req.body;

  if (!ALLOWED_CATEGORIES.includes(cat)) {
    return res.status(400).json({ error: 'Invalid category.' });
  }
  if (!ALLOWED_SEVERITIES.includes(sev)) {
    return res.status(400).json({ error: 'Invalid urgency level.' });
  }
  if (!title || !title.trim() || !loc || !loc.trim()) {
    return res.status(400).json({ error: 'Title and location are required.' });
  }

  const info = db.prepare(`
    INSERT INTO reports (user_id, category, title, description, location, severity, pos_x, pos_y, photo_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    cat,
    title.trim().slice(0, 120),
    (desc || 'No further details provided.').trim().slice(0, 2000),
    loc.trim().slice(0, 160),
    sev,
    parseFloat(x) || Math.random() * 80 + 10,
    parseFloat(y) || Math.random() * 80 + 10,
    req.file ? req.file.filename : null,
    Date.now()
  );

  const row = db.prepare(`
    SELECT reports.*, users.username FROM reports
    JOIN users ON users.id = reports.user_id WHERE reports.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json(reportToJSON(row, 0));
});

router.post('/:id/comments', requireAuth, (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comment text is required.' });
  }

  const report = db.prepare('SELECT id FROM reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  const info = db.prepare(`
    INSERT INTO comments (report_id, user_id, text, created_at) VALUES (?, ?, ?, ?)
  `).run(req.params.id, req.user.id, text.trim().slice(0, 1000), Date.now());

  res.status(201).json({
    id: info.lastInsertRowid,
    author: req.user.username,
    text: text.trim(),
    ts: Date.now()
  });
});

module.exports = router;
