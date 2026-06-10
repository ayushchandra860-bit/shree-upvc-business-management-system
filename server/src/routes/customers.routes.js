const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { query } = require('../config/db');
const { logAudit } = require('../utils/audit');

const router = express.Router();

const customerSchema = z.object({
  customer_name: z.string().trim().min(2),
  mobile_number: z.string().trim().min(10).max(20),
  site_address: z.string().trim().min(5),
  notes: z.string().trim().optional().default('')
});

router.get('/', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const params = [];
  let where = '';

  if (search) {
    params.push(`%${search}%`);
    where = `WHERE customer_name ILIKE $1 OR mobile_number ILIKE $1 OR site_address ILIKE $1`;
  }

  const result = await query(
    `SELECT id, customer_name, mobile_number, site_address, notes, created_at, updated_at
     FROM customers
     ${where}
     ORDER BY created_at DESC
     LIMIT 100`,
    params
  );

  res.json({ customers: result.rows });
}));

router.get('/:id/history', asyncHandler(async (req, res) => {
  const customer = await query(
    `SELECT id, customer_name, mobile_number, site_address, notes, created_at, updated_at
     FROM customers WHERE id = $1`,
    [req.params.id]
  );

  if (!customer.rowCount) {
    throw httpError(404, 'Customer not found');
  }

  const [quotations, orders, invoices, payments] = await Promise.all([
    query(
      `SELECT id, quotation_number, quotation_date, status, grand_total, created_at
       FROM quotations WHERE customer_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    ),
    query(
      `SELECT id, order_number, status, total_amount, confirmed_date, scheduled_installation_date, completed_date
       FROM orders WHERE customer_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    ),
    query(
      `SELECT id, invoice_number, invoice_date, final_amount, created_at
       FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    ),
    query(
      `SELECT p.id, p.receipt_number, p.payment_date, p.amount, p.payment_mode, p.reference_number,
              i.invoice_number
       FROM payments p
       LEFT JOIN invoices i ON i.id = p.invoice_id
       WHERE p.customer_id = $1
       ORDER BY p.payment_date DESC, p.created_at DESC`,
      [req.params.id]
    )
  ]);

  res.json({
    customer: customer.rows[0],
    quotations: quotations.rows,
    orders: orders.rows,
    invoices: invoices.rows,
    payments: payments.rows
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, customer_name, mobile_number, site_address, notes, created_at, updated_at
     FROM customers WHERE id = $1`,
    [req.params.id]
  );

  if (!result.rowCount) {
    throw httpError(404, 'Customer not found');
  }

  res.json({ customer: result.rows[0] });
}));

router.post('/', asyncHandler(async (req, res) => {
  const payload = customerSchema.parse(req.body);
  const result = await query(
    `INSERT INTO customers (customer_name, mobile_number, site_address, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING id, customer_name, mobile_number, site_address, notes, created_at, updated_at`,
    [payload.customer_name, payload.mobile_number, payload.site_address, payload.notes]
  );

  res.status(201).json({ customer: result.rows[0] });
  await logAudit(req, 'create', 'customer', result.rows[0].id, payload);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const payload = customerSchema.parse(req.body);
  const result = await query(
    `UPDATE customers
     SET customer_name = $1, mobile_number = $2, site_address = $3, notes = $4
     WHERE id = $5
     RETURNING id, customer_name, mobile_number, site_address, notes, created_at, updated_at`,
    [payload.customer_name, payload.mobile_number, payload.site_address, payload.notes, req.params.id]
  );

  if (!result.rowCount) {
    throw httpError(404, 'Customer not found');
  }

  res.json({ customer: result.rows[0] });
  await logAudit(req, 'update', 'customer', req.params.id, payload);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM customers WHERE id = $1 RETURNING id', [req.params.id]);
  if (!result.rowCount) {
    throw httpError(404, 'Customer not found');
  }
  await logAudit(req, 'delete', 'customer', req.params.id);
  res.json({ message: 'Customer deleted' });
}));

module.exports = router;
