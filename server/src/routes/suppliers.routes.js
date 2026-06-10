const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { query } = require('../config/db');
const { logAudit } = require('../utils/audit');

const router = express.Router();

const supplierSchema = z.object({
  supplier_name: z.string().trim().min(2),
  mobile: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  gst_number: z.string().trim().optional().default(''),
  opening_balance: z.coerce.number().default(0),
  active: z.boolean().optional().default(true)
});

router.get('/', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT s.*,
            COALESCE(sp.total_paid, 0)::numeric AS total_paid,
            (s.opening_balance - COALESCE(sp.total_paid, 0))::numeric AS pending_balance
     FROM suppliers s
     LEFT JOIN (
       SELECT supplier_id, sum(amount) AS total_paid
       FROM supplier_payments
       GROUP BY supplier_id
     ) sp ON sp.supplier_id = s.id
     ORDER BY s.created_at DESC`
  );
  res.json({ suppliers: result.rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const payload = supplierSchema.parse(req.body);
  const result = await query(
    `INSERT INTO suppliers (supplier_name, mobile, address, gst_number, opening_balance, active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [payload.supplier_name, payload.mobile, payload.address, payload.gst_number, payload.opening_balance, payload.active]
  );
  await logAudit(req, 'create', 'supplier', result.rows[0].id, payload);
  res.status(201).json({ supplier: result.rows[0] });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const payload = supplierSchema.parse(req.body);
  const result = await query(
    `UPDATE suppliers
     SET supplier_name = $1, mobile = $2, address = $3, gst_number = $4,
         opening_balance = $5, active = $6
     WHERE id = $7
     RETURNING *`,
    [payload.supplier_name, payload.mobile, payload.address, payload.gst_number, payload.opening_balance, payload.active, req.params.id]
  );
  if (!result.rowCount) throw httpError(404, 'Supplier not found');
  await logAudit(req, 'update', 'supplier', req.params.id, payload);
  res.json({ supplier: result.rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await query('UPDATE suppliers SET active = false WHERE id = $1 RETURNING id', [req.params.id]);
  if (!result.rowCount) throw httpError(404, 'Supplier not found');
  await logAudit(req, 'delete', 'supplier', req.params.id, { softDelete: true });
  res.json({ message: 'Supplier deactivated' });
}));

router.post('/:id/payments', asyncHandler(async (req, res) => {
  const payload = z.object({
    payment_date: z.string().optional(),
    amount: z.coerce.number().positive(),
    payment_type: z.enum(['Payment', 'Advance']).default('Payment'),
    payment_mode: z.string().trim().optional().default('Cash'),
    notes: z.string().trim().optional().default('')
  }).parse(req.body);
  const result = await query(
    `INSERT INTO supplier_payments (supplier_id, payment_date, amount, payment_type, payment_mode, notes)
     VALUES ($1, COALESCE($2::date, current_date), $3, $4, $5, $6)
     RETURNING *`,
    [req.params.id, payload.payment_date || null, payload.amount, payload.payment_type, payload.payment_mode, payload.notes]
  );
  await logAudit(req, 'create', 'supplier_payment', result.rows[0].id, payload);
  res.status(201).json({ payment: result.rows[0] });
}));

router.get('/:id/payments', asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM supplier_payments WHERE supplier_id = $1 ORDER BY payment_date DESC, created_at DESC',
    [req.params.id]
  );
  res.json({ payments: result.rows });
}));

module.exports = router;
