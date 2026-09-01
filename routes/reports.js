const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_CATEGORIES = ['caution', 'active', 'suspicious', 'police', 'safe'];
const ALLOWED_SEVERITIES = ['low', 'medium', 'high'];

// ---- photo upload setup ----
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'up
