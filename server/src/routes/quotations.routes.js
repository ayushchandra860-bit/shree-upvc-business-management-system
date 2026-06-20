const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { query, withTransaction, nextNumber } = require('../config/db');
const { calculateQuotation } = require('../utils/calculations');
const { generateQuotationPdf } = require('../utils/pdf');
const { logAudit } = require('../utils/audit');

const router = express.Router();

const quotationSchema = z.object({
  customer_id: z.string().uuid().optional(),
  customer_name: z.string().trim().min(2).optional(),
  mobile_number: z.string().trim().min(10).max(20).optional(),
  site_address: z.string().trim().min(5).optional(),
  quotation_date: z.string().optional(),
  transportation_charges: z.coerce.number().min(0).optional().default(0),
  installation_charges: z.coerce.number().min(0).optional().default(0),
  manufacturing_charges: z.coerce.number().min(0).optional().default(0),
  discount: z.coerce.number().min(0).optional().default(0),
  gst_percent: z.coerce.number().min(0).max(28).optional().default(18),
  notes: z.string().trim().optional().default(''),
  terms_conditions: z.string().trim().optional().default('This quotation covers fabrication, TRANSPORTATION and installation as specifically listed. Final production quantities remain subject to approved site measurements before manufacturing. Delivery timelines begin after design approval and advance confirmation.'),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    width_mm: z.coerce.number().positive(),
    height_mm: z.coerce.number().positive(),
    quantity: z.coerce.number().int().positive()
  })).min(1)
});

async function getQuotationById(id) {
  const quotation = await query(
    `SELECT q.*, c.customer_name AS linked_customer_name
     FROM quotations q
     LEFT JOIN customers c ON c.id = q.customer_id
     WHERE q.id = $1`,
    [id]
  );

  if (!quotation.rowCount) {
    throw httpError(404, 'Quotation not found');
  }

  const items = await query(
    `SELECT qi.*, p.category
     FROM quotation_items qi
     LEFT JOIN products p ON p.id = qi.product_id
     WHERE qi.quotation_id = $1
     ORDER BY qi.created_at ASC`,
    [id]
  );

  return {
    quotation: quotation.rows[0],
    items: items.rows
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, quotation_number, quotation_date, customer_id, customer_name, mobile_number,
            site_address, status, subtotal, gst_amount, grand_total, created_at
     FROM quotations
     ORDER BY created_at DESC
     LIMIT 100`
  );

  res.json({ quotations: result.rows });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await getQuotationById(req.params.id));
}));

async function resolveQuotationPayload(client, payload) {
  let customer;

  if (payload.customer_id) {
    const customerResult = await client.query(
      `SELECT id, customer_name, mobile_number, site_address
       FROM customers WHERE id = $1`,
      [payload.customer_id]
    );

    if (!customerResult.rowCount) {
      throw httpError(404, 'Customer not found');
    }

    customer = customerResult.rows[0];
  } else {
    if (!payload.customer_name || !payload.mobile_number || !payload.site_address) {
      throw httpError(400, 'Customer details are required');
    }

    const createdCustomer = await client.query(
      `INSERT INTO customers (customer_name, mobile_number, site_address, notes)
       VALUES ($1, $2, $3, '')
       RETURNING id, customer_name, mobile_number, site_address`,
      [payload.customer_name, payload.mobile_number, payload.site_address]
    );

    customer = createdCustomer.rows[0];
  }

  const productIds = payload.items.map((item) => item.product_id);
  const products = await client.query(
    `SELECT id, product_name, rate_per_sqft
     FROM products
     WHERE id = ANY($1::uuid[]) AND active = true`,
    [productIds]
  );

  const productMap = new Map(products.rows.map((product) => [product.id, product]));
  if (productMap.size !== new Set(productIds).size) {
    throw httpError(400, 'One or more products are invalid or inactive');
  }

  const enrichedItems = payload.items.map((item) => {
    const product = productMap.get(item.product_id);
    return {
      ...item,
      product_type: product.product_name,
      rate_per_sqft: product.rate_per_sqft
    };
  });

  return {
    customer,
    calculation: calculateQuotation(enrichedItems, payload)
  };
}

router.post('/', asyncHandler(async (req, res) => {
  const payload = quotationSchema.parse(req.body);

  const result = await withTransaction(async (client) => {
    const { customer, calculation } = await resolveQuotationPayload(client, payload);
    const quotationNumber = await nextNumber(client, 'quotation');
    const quotation = await client.query(
      `INSERT INTO quotations (
         quotation_number, quotation_date, customer_id, customer_name, mobile_number, site_address,
         transportation_charges, installation_charges, manufacturing_charges, discount, gst_percent,
         subtotal, gst_amount, grand_total, notes, terms_conditions
       )
       VALUES ($1, COALESCE($2::date, current_date), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        quotationNumber,
        payload.quotation_date || null,
        customer.id,
        customer.customer_name,
        customer.mobile_number,
        customer.site_address,
        payload.transportation_charges,
        payload.installation_charges,
        payload.manufacturing_charges,
        payload.discount,
        calculation.totals.gst_percent,
        calculation.totals.subtotal,
        calculation.totals.gst_amount,
        calculation.totals.grand_total,
        payload.notes,
        payload.terms_conditions
      ]
    );

    for (const item of calculation.items) {
      await client.query(
        `INSERT INTO quotation_items (
           quotation_id, product_id, product_type, width_mm, height_mm, quantity,
           area_sqft, total_sqft, rate_per_sqft, product_amount
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          quotation.rows[0].id,
          item.product_id,
          item.product_type,
          item.width_mm,
          item.height_mm,
          item.quantity,
          item.area_sqft,
          item.total_sqft,
          item.rate_per_sqft,
          item.product_amount
        ]
      );
    }

    return quotation.rows[0];
  });

  await logAudit(req, 'create', 'quotation', result.id, { quotation_number: result.quotation_number });
  res.status(201).json(await getQuotationById(result.id));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const payload = quotationSchema.parse(req.body);
  const result = await withTransaction(async (client) => {
    const existing = await client.query('SELECT id FROM quotations WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!existing.rowCount) throw httpError(404, 'Quotation not found');

    const { customer, calculation } = await resolveQuotationPayload(client, payload);
    const updated = await client.query(
      `UPDATE quotations
       SET quotation_date = COALESCE($1::date, quotation_date),
           customer_id = $2,
           customer_name = $3,
           mobile_number = $4,
           site_address = $5,
           transportation_charges = $6,
           installation_charges = $7,
           manufacturing_charges = $8,
           discount = $9,
           gst_percent = $10,
           subtotal = $11,
           gst_amount = $12,
           grand_total = $13,
           notes = $14,
           terms_conditions = $15
       WHERE id = $16
       RETURNING *`,
      [
        payload.quotation_date || null,
        customer.id,
        customer.customer_name,
        customer.mobile_number,
        customer.site_address,
        payload.transportation_charges,
        payload.installation_charges,
        payload.manufacturing_charges,
        payload.discount,
        calculation.totals.gst_percent,
        calculation.totals.subtotal,
        calculation.totals.gst_amount,
        calculation.totals.grand_total,
        payload.notes,
        payload.terms_conditions,
        req.params.id
      ]
    );

    await client.query('DELETE FROM quotation_items WHERE quotation_id = $1', [req.params.id]);
    for (const item of calculation.items) {
      await client.query(
        `INSERT INTO quotation_items (
           quotation_id, product_id, product_type, width_mm, height_mm, quantity,
           area_sqft, total_sqft, rate_per_sqft, product_amount
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          req.params.id,
          item.product_id,
          item.product_type,
          item.width_mm,
          item.height_mm,
          item.quantity,
          item.area_sqft,
          item.total_sqft,
          item.rate_per_sqft,
          item.product_amount
        ]
      );
    }

    return updated.rows[0];
  });

  await logAudit(req, 'update', 'quotation', req.params.id, { quotation_number: result.quotation_number });
  res.json(await getQuotationById(req.params.id));
}));

router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const result = await withTransaction(async (client) => {
    const quotation = await client.query('SELECT * FROM quotations WHERE id = $1', [req.params.id]);
    if (!quotation.rowCount) throw httpError(404, 'Quotation not found');
    const items = await client.query('SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY created_at ASC', [req.params.id]);
    const quotationNumber = await nextNumber(client, 'quotation');
    const copied = await client.query(
      `INSERT INTO quotations (
         quotation_number, quotation_date, customer_id, customer_name, mobile_number, site_address,
         transportation_charges, installation_charges, manufacturing_charges, discount, gst_percent,
         subtotal, gst_amount, grand_total, status, notes, terms_conditions
       )
       VALUES ($1, current_date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Quotation Created', $14, $15)
       RETURNING *`,
      [
        quotationNumber,
        quotation.rows[0].customer_id,
        quotation.rows[0].customer_name,
        quotation.rows[0].mobile_number,
        quotation.rows[0].site_address,
        quotation.rows[0].transportation_charges,
        quotation.rows[0].installation_charges,
        quotation.rows[0].manufacturing_charges,
        quotation.rows[0].discount,
        quotation.rows[0].gst_percent,
        quotation.rows[0].subtotal,
        quotation.rows[0].gst_amount,
        quotation.rows[0].grand_total,
        quotation.rows[0].notes,
        quotation.rows[0].terms_conditions
      ]
    );

    for (const item of items.rows) {
      await client.query(
        `INSERT INTO quotation_items (
           quotation_id, product_id, product_type, width_mm, height_mm, quantity,
           area_sqft, total_sqft, rate_per_sqft, product_amount
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          copied.rows[0].id,
          item.product_id,
          item.product_type,
          item.width_mm,
          item.height_mm,
          item.quantity,
          item.area_sqft,
          item.total_sqft,
          item.rate_per_sqft,
          item.product_amount
        ]
      );
    }

    return copied.rows[0];
  });

  await logAudit(req, 'duplicate', 'quotation', req.params.id, { newQuotationId: result.id });
  res.status(201).json(await getQuotationById(result.id));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM quotations WHERE id = $1 RETURNING id', [req.params.id]);
  if (!result.rowCount) throw httpError(404, 'Quotation not found');
  await logAudit(req, 'delete', 'quotation', req.params.id);
  res.json({ message: 'Quotation deleted' });
}));

router.get('/:id/pdf', asyncHandler(async (req, res) => {
  const { quotation, items } = await getQuotationById(req.params.id);
  const settings = await query('SELECT * FROM company_settings WHERE id = true');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.download === 'true' ? 'attachment' : 'inline'}; filename="${quotation.quotation_number}.pdf"`);
  generateQuotationPdf(quotation, items, res, settings.rows[0]);
}));

router.post('/:id/confirm', asyncHandler(async (req, res) => {
  const result = await withTransaction(async (client) => {
    const quotation = await client.query('SELECT * FROM quotations WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!quotation.rowCount) {
      throw httpError(404, 'Quotation not found');
    }

    const existingOrder = await client.query('SELECT * FROM orders WHERE quotation_id = $1', [req.params.id]);
    if (existingOrder.rowCount) {
      return existingOrder.rows[0];
    }

    const orderNumber = await nextNumber(client, 'order');
    const order = await client.query(
      `INSERT INTO orders (order_number, quotation_id, customer_id, status, total_amount)
       VALUES ($1, $2, $3, 'Order Confirmed', $4)
       RETURNING *`,
      [orderNumber, quotation.rows[0].id, quotation.rows[0].customer_id, quotation.rows[0].grand_total]
    );

    await client.query(
      `UPDATE quotations SET status = 'Order Confirmed' WHERE id = $1`,
      [quotation.rows[0].id]
    );

    await client.query(
      `INSERT INTO order_status_history (order_id, status, notes, changed_by)
       VALUES ($1, 'Order Confirmed', 'Quotation converted to order', $2)`,
      [order.rows[0].id, req.session.adminUser.id]
    );

    return order.rows[0];
  });

  res.status(201).json({ order: result });
}));

module.exports = router;
