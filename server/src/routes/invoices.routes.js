const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { query, withTransaction, nextNumber } = require('../config/db');
const { generateInvoicePdf } = require('../utils/pdf');

const router = express.Router();

const invoiceSchema = z.object({
  quotation_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  invoice_date: z.string().optional(),
  notes: z.string().trim().optional().default(''),
  terms_conditions: z.string().trim().optional()
}).refine((value) => value.quotation_id || value.order_id, {
  message: 'quotation_id or order_id is required'
});

const invoiceUpdateSchema = z.object({
  invoice_date: z.string().optional(),
  transportation_charges: z.coerce.number().min(0).optional(),
  installation_charges: z.coerce.number().min(0).optional(),
  manufacturing_charges: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional(),
  gst_percent: z.coerce.number().min(0).max(28).optional(),
  notes: z.string().trim().optional().default(''),
  terms_conditions: z.string().trim().optional().default('')
});

async function getInvoiceById(id) {
  const invoice = await query(
    `SELECT i.*, q.quotation_number, o.order_number
     FROM invoices i
     LEFT JOIN quotations q ON q.id = i.quotation_id
     LEFT JOIN orders o ON o.id = i.order_id
     WHERE i.id = $1`,
    [id]
  );

  if (!invoice.rowCount) {
    throw httpError(404, 'Invoice not found');
  }

  const items = await query(
    `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at ASC`,
    [id]
  );

  return {
    invoice: invoice.rows[0],
    items: items.rows
  };
}

async function refreshInvoicePayment(client, invoiceId) {
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
    `SELECT i.id, i.invoice_number, i.invoice_date, i.customer_name, i.mobile_number,
            i.site_address, i.subtotal, i.gst_amount, i.final_amount,
            i.payment_status, i.paid_amount, i.remaining_amount,
            q.quotation_number, o.order_number, i.created_at
     FROM invoices i
     LEFT JOIN quotations q ON q.id = i.quotation_id
     LEFT JOIN orders o ON o.id = i.order_id
     ORDER BY i.created_at DESC
     LIMIT 100`
  );

  res.json({ invoices: result.rows });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await getInvoiceById(req.params.id));
}));

router.post('/', asyncHandler(async (req, res) => {
  const payload = invoiceSchema.parse(req.body);

  const result = await withTransaction(async (client) => {
    let order = null;
    let quotationId = payload.quotation_id || null;

    if (payload.order_id) {
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1',
        [payload.order_id]
      );
      if (!orderResult.rowCount) {
        throw httpError(404, 'Order not found');
      }
      order = orderResult.rows[0];
      quotationId = order.quotation_id || quotationId;
    }

    const quotation = await client.query(
      'SELECT * FROM quotations WHERE id = $1',
      [quotationId]
    );
    if (!quotation.rowCount) {
      throw httpError(404, 'Quotation not found');
    }

    const quotationItems = await client.query(
      `SELECT product_type, width_mm, height_mm, quantity, total_sqft, rate_per_sqft, product_amount
       FROM quotation_items
       WHERE quotation_id = $1
       ORDER BY created_at ASC`,
      [quotationId]
    );

    if (!quotationItems.rowCount) {
      throw httpError(400, 'Quotation has no items');
    }

    const productSubtotal = quotationItems.rows.reduce((sum, item) => sum + Number(item.product_amount || 0), 0);
    const chargesTotal = Number(quotation.rows[0].transportation_charges || 0)
      + Number(quotation.rows[0].installation_charges || 0)
      + Number(quotation.rows[0].manufacturing_charges || 0)
      - Number(quotation.rows[0].discount || 0);
    const taxableAmount = Math.max(productSubtotal + chargesTotal, 0);
    const gstAmount = taxableAmount * Number(quotation.rows[0].gst_percent || 0) / 100;
    const finalAmount = taxableAmount + gstAmount;

    const invoiceNumber = await nextNumber(client, 'invoice');
    const invoice = await client.query(
      `INSERT INTO invoices (
         invoice_number, invoice_date, quotation_id, order_id, customer_id,
         customer_name, mobile_number, site_address, subtotal, gst_percent,
         transportation_charges, installation_charges, manufacturing_charges, discount,
         gst_amount, final_amount, remaining_amount, notes, terms_conditions
       )
       VALUES ($1, COALESCE($2::date, current_date), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        invoiceNumber,
        payload.invoice_date || null,
        quotation.rows[0].id,
        order?.id || null,
        quotation.rows[0].customer_id,
        quotation.rows[0].customer_name,
        quotation.rows[0].mobile_number,
        quotation.rows[0].site_address,
        productSubtotal,
        quotation.rows[0].gst_percent,
        quotation.rows[0].transportation_charges || 0,
        quotation.rows[0].installation_charges || 0,
        quotation.rows[0].manufacturing_charges || 0,
        quotation.rows[0].discount || 0,
        gstAmount,
        finalAmount,
        finalAmount,
        payload.notes,
        payload.terms_conditions || quotation.rows[0].terms_conditions || ''
      ]
    );

    for (const item of quotationItems.rows) {
      await client.query(
        `INSERT INTO invoice_items (
           invoice_id, product_type, width_mm, height_mm, quantity,
           total_sqft, rate_per_sqft, product_amount
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          invoice.rows[0].id,
          item.product_type,
          item.width_mm,
          item.height_mm,
          item.quantity,
          item.total_sqft,
          item.rate_per_sqft,
          item.product_amount
        ]
      );
    }

    return invoice.rows[0];
  });

  res.status(201).json(await getInvoiceById(result.id));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const payload = invoiceUpdateSchema.parse(req.body);
  const invoice = await withTransaction(async (client) => {
    const existing = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!existing.rowCount) throw httpError(404, 'Invoice not found');
    const current = existing.rows[0];
    const subtotal = Number(current.subtotal || 0);
    const transportation = Number(payload.transportation_charges ?? current.transportation_charges ?? 0);
    const installation = Number(payload.installation_charges ?? current.installation_charges ?? 0);
    const manufacturing = Number(payload.manufacturing_charges ?? current.manufacturing_charges ?? 0);
    const discount = Number(payload.discount ?? current.discount ?? 0);
    const gstPercent = Number(payload.gst_percent ?? current.gst_percent ?? 18);
    const taxable = Math.max(subtotal + transportation + installation + manufacturing - discount, 0);
    const gstAmount = taxable * gstPercent / 100;
    const finalAmount = taxable + gstAmount;
    const paidAmount = Number(current.paid_amount || 0);
    const remainingAmount = Math.max(finalAmount - paidAmount, 0);
    const paymentStatus = paidAmount <= 0 ? 'Unpaid' : remainingAmount <= 0 ? 'Paid' : 'Partial Paid';

    const result = await client.query(
      `UPDATE invoices
       SET invoice_date = COALESCE($1::date, invoice_date),
           transportation_charges = $2,
           installation_charges = $3,
           manufacturing_charges = $4,
           discount = $5,
           gst_percent = $6,
           gst_amount = $7,
           final_amount = $8,
           remaining_amount = $9,
           payment_status = $10,
           notes = $11,
           terms_conditions = $12
       WHERE id = $13
       RETURNING *`,
      [
        payload.invoice_date || null,
        transportation,
        installation,
        manufacturing,
        discount,
        gstPercent,
        gstAmount,
        finalAmount,
        remainingAmount,
        paymentStatus,
        payload.notes,
        payload.terms_conditions,
        req.params.id
      ]
    );
    return result.rows[0];
  });

  res.json({ invoice });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM invoices WHERE id = $1 RETURNING id', [req.params.id]);
  if (!result.rowCount) throw httpError(404, 'Invoice not found');
  res.json({ message: 'Invoice deleted' });
}));

router.get('/:id/pdf', asyncHandler(async (req, res) => {
  const { invoice, items } = await getInvoiceById(req.params.id);
  const settings = await query('SELECT * FROM company_settings WHERE id = true');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${req.query.download === 'true' ? 'attachment' : 'inline'}; filename="${invoice.invoice_number}.pdf"`
  );

  generateInvoicePdf(invoice, items, res, settings.rows[0]);
}));

router.refreshInvoicePayment = refreshInvoicePayment;

module.exports = router;
