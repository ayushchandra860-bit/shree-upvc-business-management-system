const express = require('express');
const PDFDocument = require('pdfkit');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { query, withTransaction, nextNumber } = require('../config/db');
const { currency } = require('../utils/pdf');
const { logAudit } = require('../utils/audit');

const router = express.Router();

const paymentSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  invoice_id: z.string().uuid().optional().nullable(),
  payment_date: z.string().optional(),
  amount: z.coerce.number().positive(),
  payment_mode: z.string().trim().min(2).default('Cash'),
  reference_number: z.string().trim().optional().default(''),
  notes: z.string().trim().optional().default('')
});

async function refreshInvoicePayment(client, invoiceId) {
  if (!invoiceId) return;
  const payments = await client.query(
    'SELECT COALESCE(sum(amount), 0)::numeric AS paid FROM payments WHERE invoice_id = $1',
    [invoiceId]
  );
  const invoice = await client.query('SELECT final_amount FROM invoices WHERE id = $1', [invoiceId]);
  if (!invoice.rowCount) return;
  const paidAmount = Number(payments.rows[0].paid || 0);
  const finalAmount = Number(invoice.rows[0].final_amount || 0);
  const remaining = Math.max(finalAmount - paidAmount, 0);
  const status = paidAmount <= 0 ? 'Unpaid' : remaining <= 0 ? 'Paid' : 'Partial Paid';
  await client.query(
    `UPDATE invoices
     SET paid_amount = $1, remaining_amount = $2, payment_status = $3
     WHERE id = $4`,
    [paidAmount, remaining, status, invoiceId]
  );
}

router.get('/', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT p.*, c.customer_name, i.invoice_number, i.final_amount, i.payment_status
     FROM payments p
     LEFT JOIN customers c ON c.id = p.customer_id
     LEFT JOIN invoices i ON i.id = p.invoice_id
     ORDER BY p.payment_date DESC, p.created_at DESC
     LIMIT 200`
  );
  res.json({ payments: result.rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const payload = paymentSchema.parse(req.body);
  const payment = await withTransaction(async (client) => {
    let customerId = payload.customer_id || null;
    if (payload.invoice_id) {
      const invoice = await client.query('SELECT customer_id FROM invoices WHERE id = $1', [payload.invoice_id]);
      if (!invoice.rowCount) throw httpError(404, 'Invoice not found');
      customerId = invoice.rows[0].customer_id;
    }
    const receiptNumber = await nextNumber(client, 'payment');
    const result = await client.query(
      `INSERT INTO payments (
         receipt_number, customer_id, invoice_id, payment_date, amount,
         payment_mode, reference_number, notes, created_by
       )
       VALUES ($1, $2, $3, COALESCE($4::date, current_date), $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        receiptNumber,
        customerId,
        payload.invoice_id || null,
        payload.payment_date || null,
        payload.amount,
        payload.payment_mode,
        payload.reference_number,
        payload.notes,
        req.session.adminUser.id
      ]
    );
    await refreshInvoicePayment(client, payload.invoice_id);
    return result.rows[0];
  });
  await logAudit(req, 'create', 'payment', payment.id, payload);
  res.status(201).json({ payment });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const payload = paymentSchema.parse(req.body);
  const payment = await withTransaction(async (client) => {
    const existing = await client.query('SELECT invoice_id FROM payments WHERE id = $1', [req.params.id]);
    if (!existing.rowCount) throw httpError(404, 'Payment not found');
    const result = await client.query(
      `UPDATE payments
       SET customer_id = $1, invoice_id = $2, payment_date = COALESCE($3::date, payment_date),
           amount = $4, payment_mode = $5, reference_number = $6, notes = $7
       WHERE id = $8
       RETURNING *`,
      [
        payload.customer_id || null,
        payload.invoice_id || null,
        payload.payment_date || null,
        payload.amount,
        payload.payment_mode,
        payload.reference_number,
        payload.notes,
        req.params.id
      ]
    );
    await refreshInvoicePayment(client, existing.rows[0].invoice_id);
    await refreshInvoicePayment(client, payload.invoice_id);
    return result.rows[0];
  });
  await logAudit(req, 'update', 'payment', req.params.id, payload);
  res.json({ payment });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await withTransaction(async (client) => {
    const existing = await client.query('DELETE FROM payments WHERE id = $1 RETURNING invoice_id', [req.params.id]);
    if (!existing.rowCount) throw httpError(404, 'Payment not found');
    await refreshInvoicePayment(client, existing.rows[0].invoice_id);
  });
  await logAudit(req, 'delete', 'payment', req.params.id);
  res.json({ message: 'Payment deleted' });
}));

router.get('/:id/receipt', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT p.*, c.customer_name, c.mobile_number, i.invoice_number
     FROM payments p
     LEFT JOIN customers c ON c.id = p.customer_id
     LEFT JOIN invoices i ON i.id = p.invoice_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (!result.rowCount) throw httpError(404, 'Payment not found');
  const payment = result.rows[0];

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${payment.receipt_number}.pdf"`);

  const doc = new PDFDocument({ margin: 42, size: 'A4' });
  doc.pipe(res);
  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(18).text('SHREE UPVC WINDOWS & DOORS');
  doc.fillColor('#4b5563').font('Helvetica').fontSize(10)
    .text('Baba Market, Lekha Nagar, Danapur, Patna - 801105, Bihar')
    .moveDown(2);
  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(20).text('PAYMENT RECEIPT', { align: 'center' });
  doc.moveDown();
  [
    ['Receipt Number', payment.receipt_number],
    ['Date', payment.payment_date],
    ['Customer', payment.customer_name],
    ['Mobile', payment.mobile_number],
    ['Invoice', payment.invoice_number || '-'],
    ['Payment Mode', payment.payment_mode],
    ['Reference', payment.reference_number || '-'],
    ['Amount Received', currency(payment.amount)]
  ].forEach(([label, value]) => {
    doc.font('Helvetica-Bold').fillColor('#374151').text(`${label}: `, { continued: true });
    doc.font('Helvetica').fillColor('#111827').text(String(value || '-'));
  });
  doc.moveDown(3);
  doc.text('Authorized Signature', 42, 680);
  doc.text('Customer Signature', 390, 680);
  doc.end();
}));

module.exports = router;
