const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { query } = require('../config/db');
const { logAudit } = require('../utils/audit');

const router = express.Router();

router.get('/admins', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, email, role, active, last_login_at, created_at
     FROM admin_users
     ORDER BY created_at DESC`
  );
  res.json({ admins: result.rows });
}));

router.post('/admins', asyncHandler(async (req, res) => {
  const payload = z.object({
    name: z.string().trim().min(2),
    email: z.string().email(),
    password: z.string().min(12),
    role: z.string().trim().optional().default('Admin')
  }).parse(req.body);
  const hash = await bcrypt.hash(payload.password, 12);
  const result = await query(
    `INSERT INTO admin_users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, active, created_at`,
    [payload.name, payload.email, hash, payload.role]
  );
  await logAudit(req, 'create', 'admin_user', result.rows[0].id, { email: payload.email, role: payload.role });
  res.status(201).json({ admin: result.rows[0] });
}));

router.post('/change-password', asyncHandler(async (req, res) => {
  const payload = z.object({
    current_password: z.string().min(8),
    new_password: z.string().min(12)
  }).parse(req.body);
  const admin = await query('SELECT password_hash FROM admin_users WHERE id = $1', [req.session.adminUser.id]);
  if (!admin.rowCount) throw httpError(404, 'Admin not found');
  const valid = await bcrypt.compare(payload.current_password, admin.rows[0].password_hash);
  if (!valid) throw httpError(400, 'Current password is incorrect');
  const hash = await bcrypt.hash(payload.new_password, 12);
  await query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, req.session.adminUser.id]);
  await logAudit(req, 'change_password', 'admin_user', req.session.adminUser.id);
  res.json({ message: 'Password changed successfully' });
}));

router.delete('/admins/:id', asyncHandler(async (req, res) => {
  if (req.params.id === req.session.adminUser.id) {
    throw httpError(400, 'You cannot delete your own admin account');
  }
  const result = await query('UPDATE admin_users SET active = false WHERE id = $1 RETURNING id', [req.params.id]);
  if (!result.rowCount) throw httpError(404, 'Admin not found');
  await logAudit(req, 'delete', 'admin_user', req.params.id, { softDelete: true });
  res.json({ message: 'Admin deactivated' });
}));

router.get('/audit-logs', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT l.*, a.name AS admin_name, a.email AS admin_email
     FROM audit_logs l
     LEFT JOIN admin_users a ON a.id = l.admin_user_id
     ORDER BY l.created_at DESC
     LIMIT 200`
  );
  res.json({ logs: result.rows });
}));

router.get('/login-history', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT h.*, a.name AS admin_name
     FROM login_history h
     LEFT JOIN admin_users a ON a.id = h.admin_user_id
     ORDER BY h.created_at DESC
     LIMIT 200`
  );
  res.json({ history: result.rows });
}));

module.exports = router;
