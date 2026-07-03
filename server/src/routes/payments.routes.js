const express = require('express');
const PDFDocument = require('pdfkit');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { query, withTransaction, nextNumber, getCompanySettings } = require('../config/db');
const { currency, formatDocumentDate, normalizeSettings, drawCompanyHeader, drawCustomerSection, drawFinancialSummaryCard, drawTextSection, drawDocumentFooter } = require('../utils/pdf');
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
     , c.site_address, c.gst_number FROM payments p
     LEFT JOIN customers c ON c.id = p.customer_id
     LEFT JOIN invoices i ON i.id = p.invoice_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (!result.rowCount) throw httpError(404, 'Payment not found');
  const payment = result.rows[0];
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Payment_Receipt_${payment.receipt_number}.pdf"`);

  const doc = new PDFDocument({ margin: 42, size: 'A4' }); // Use PAGE_MARGIN from pdf.js if exposed
  doc.pipe(res);
  const companySettings = await getCompanySettings();
  const resolvedSettings = normalizeSettings(companySettings);

  let currentY = drawCompanyHeader(doc, resolvedSettings, 'PAYMENT RECEIPT');

  // Customer Section for Payment Receipt
  currentY = drawCustomerSection(doc, {
    customer_name: payment.customer_name,
    mobile_number: payment.mobile_number,
    site_address: payment.site_address || '-',
    gst_number: payment.gst_number || '-'
  }, currentY, 'Received From', [
    ['Receipt No', payment.receipt_number],
    ['Date', formatDocumentDate(payment.payment_date)],
    ['Invoice No', payment.invoice_number || '-']
  ]);

  currentY += 12;

  // Payment Details Summary
  const summaryX = 42; // Use PAGE_MARGIN
  const summaryWidth = 595 - 2 * 42; // Use PAGE_MARGIN
  const paymentSummaryRows = [
    ['Payment Mode', payment.payment_mode],
    ['Reference No', payment.reference_number || '-'],
    ['Notes', payment.notes || '-']
  ];
  currentY += drawFinancialSummaryCard(doc, summaryX, currentY, summaryWidth, 'Payment Details', paymentSummaryRows, payment.amount);

  currentY += 12;

  // Notes (if any)
  if (payment.notes) {
    currentY = drawTextSection(doc, 'Notes', payment.notes, currentY);
  }

  // Footer
  drawDocumentFooter(doc, resolvedSettings, currentY, 'Received By', 'Customer Signature', `This is a computer-generated payment receipt issued by ${resolvedSettings.company_name}.`);

  doc.end();
}));

module.exports = router;
