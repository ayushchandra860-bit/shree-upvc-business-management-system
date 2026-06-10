const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { query, withTransaction, nextNumber } = require('../config/db');
const { logAudit } = require('../utils/audit');

const router = express.Router();

const statusValues = [
  'Quotation Created',
  'Order Confirmed',
  'Manufacturing',
  'Installation Scheduled',
  'Installation Completed'
];

const statusSchema = z.object({
  status: z.enum(statusValues),
  scheduled_installation_date: z.string().optional().nullable(),
  completed_date: z.string().optional().nullable(),
  notes: z.string().trim().optional().default('')
});

const orderSchema = z.object({
  quotation_id: z.string().uuid(),
  status: z.enum(statusValues).optional().default('Order Confirmed'),
  scheduled_installation_date: z.string().optional().nullable(),
  notes: z.string().trim().optional().default('')
});

router.get('/', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT o.*, q.quotation_number, c.customer_name, c.mobile_number, c.site_address
     FROM orders o
     LEFT JOIN quotations q ON q.id = o.quotation_id
     LEFT JOIN customers c ON c.id = o.customer_id
     ORDER BY o.created_at DESC
     LIMIT 100`
  );

  res.json({ orders: result.rows });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const order = await query(
    `SELECT o.*, q.quotation_number, c.customer_name, c.mobile_number, c.site_address
     FROM orders o
     LEFT JOIN quotations q ON q.id = o.quotation_id
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.id = $1`,
    [req.params.id]
  );

  if (!order.rowCount) {
    throw httpError(404, 'Order not found');
  }

  const history = await query(
    `SELECT h.*, a.name AS changed_by_name
     FROM order_status_history h
     LEFT JOIN admin_users a ON a.id = h.changed_by
     WHERE h.order_id = $1
     ORDER BY h.changed_at DESC`,
    [req.params.id]
  );

  res.json({ order: order.rows[0], history: history.rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const payload = orderSchema.parse(req.body);
  const order = await withTransaction(async (client) => {
    const quotation = await client.query('SELECT * FROM quotations WHERE id = $1 FOR UPDATE', [payload.quotation_id]);
    if (!quotation.rowCount) throw httpError(404, 'Quotation not found');
    const existing = await client.query('SELECT * FROM orders WHERE quotation_id = $1', [payload.quotation_id]);
    if (existing.rowCount) throw httpError(409, 'Order already exists for this quotation');
    const orderNumber = await nextNumber(client, 'order');
    const result = await client.query(
      `INSERT INTO orders (order_number, quotation_id, customer_id, status, total_amount, scheduled_installation_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7)
       RETURNING *`,
      [
        orderNumber,
        payload.quotation_id,
        quotation.rows[0].customer_id,
        payload.status,
        quotation.rows[0].grand_total,
        payload.scheduled_installation_date || null,
        payload.notes
      ]
    );
    await client.query('UPDATE quotations SET status = $1 WHERE id = $2', [payload.status, payload.quotation_id]);
    await client.query(
      `INSERT INTO order_status_history (order_id, status, notes, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [result.rows[0].id, payload.status, payload.notes, req.session.adminUser.id]
    );
    return result.rows[0];
  });
  await logAudit(req, 'create', 'order', order.id, payload);
  res.status(201).json({ order });
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const payload = statusSchema.parse(req.body);

  const order = await withTransaction(async (client) => {
    const existing = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!existing.rowCount) {
      throw httpError(404, 'Order not found');
    }

    const scheduledDate = payload.status === 'Installation Scheduled'
      ? payload.scheduled_installation_date || existing.rows[0].scheduled_installation_date
      : existing.rows[0].scheduled_installation_date;

    const completedDate = payload.status === 'Installation Completed'
      ? payload.completed_date || new Date().toISOString().slice(0, 10)
      : existing.rows[0].completed_date;

    const updated = await client.query(
      `UPDATE orders
       SET status = $1,
           scheduled_installation_date = $2,
           completed_date = $3,
           notes = $4
       WHERE id = $5
       RETURNING *`,
      [payload.status, scheduledDate || null, completedDate || null, payload.notes, req.params.id]
    );

    if (updated.rows[0].quotation_id) {
      await client.query(
        `UPDATE quotations SET status = $1 WHERE id = $2`,
        [payload.status, updated.rows[0].quotation_id]
      );
    }

    await client.query(
      `INSERT INTO order_status_history (order_id, status, notes, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [req.params.id, payload.status, payload.notes, req.session.adminUser.id]
    );

    return updated.rows[0];
  });

  res.json({ order });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM orders WHERE id = $1 RETURNING id, quotation_id', [req.params.id]);
  if (!result.rowCount) throw httpError(404, 'Order not found');
  if (result.rows[0].quotation_id) {
    await query(`UPDATE quotations SET status = 'Quotation Created' WHERE id = $1`, [result.rows[0].quotation_id]);
  }
  await logAudit(req, 'delete', 'order', req.params.id);
  res.json({ message: 'Order deleted' });
}));

module.exports = router;
