const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

router.post('/login', asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const result = await query(
    `SELECT id, name, email, password_hash
     FROM admin_users
     WHERE lower(email) = lower($1) AND active = true
     LIMIT 1`,
    [payload.email]
  );

  if (!result.rowCount) {
    await query(
      `INSERT INTO login_history (email, success, ip_address, user_agent)
       VALUES ($1, false, $2, $3)`,
      [payload.email, req.ip || '', req.get('user-agent') || '']
    );
    throw httpError(401, 'Invalid email or password');
  }

  const admin = result.rows[0];
  const valid = await bcrypt.compare(payload.password, admin.password_hash);
  if (!valid) {
    await query(
      `INSERT INTO login_history (admin_user_id, email, success, ip_address, user_agent)
       VALUES ($1, $2, false, $3, $4)`,
      [admin.id, payload.email, req.ip || '', req.get('user-agent') || '']
    );
    throw httpError(401, 'Invalid email or password');
  }

  await regenerateSession(req);
  req.session.adminUser = {
    id: admin.id,
    name: admin.name,
    email: admin.email
  };

  await query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [admin.id]);
  await query(
    `INSERT INTO login_history (admin_user_id, email, success, ip_address, user_agent)
     VALUES ($1, $2, true, $3, $4)`,
    [admin.id, admin.email, req.ip || '', req.get('user-agent') || '']
  );

  res.json({
    user: req.session.adminUser
  });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.session.adminUser });
});

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await destroySession(req);
  res.clearCookie('shree_upvc_sid');
  res.json({ message: 'Logged out successfully' });
}));

module.exports = router;
