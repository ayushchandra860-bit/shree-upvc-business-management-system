const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { query } = require('../config/db');
const { logAudit } = require('../utils/audit');

const router = express.Router();

const productSchema = z.object({
  product_name: z.string().trim().min(2),
  category: z.enum(['Window', 'Door']),
  rate_per_sqft: z.coerce.number().min(0),
  description: z.string().trim().optional().default(''),
  active: z.boolean().optional().default(true)
});

router.get('/', asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const [result, categories] = await Promise.all([
    query(
    `SELECT id, product_name, category, rate_per_sqft, description, active, created_at, updated_at
     FROM products
     ${includeInactive ? '' : 'WHERE active = true'}
     ORDER BY category DESC, product_name ASC`
    ),
    query('SELECT * FROM product_categories ORDER BY category_name ASC')
  ]);

  res.json({ products: result.rows, categories: categories.rows });
}));

router.post('/categories', asyncHandler(async (req, res) => {
  const payload = z.object({
    category_name: z.string().trim().min(2),
    description: z.string().trim().optional().default(''),
    active: z.boolean().optional().default(true)
  }).parse(req.body);
  const result = await query(
    `INSERT INTO product_categories (category_name, description, active)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [payload.category_name, payload.description, payload.active]
  );
  await logAudit(req, 'create', 'product_category', result.rows[0].id, payload);
  res.status(201).json({ category: result.rows[0] });
}));

router.put('/categories/:id', asyncHandler(async (req, res) => {
  const payload = z.object({
    category_name: z.string().trim().min(2),
    description: z.string().trim().optional().default(''),
    active: z.boolean().optional().default(true)
  }).parse(req.body);
  const result = await query(
    `UPDATE product_categories
     SET category_name = $1, description = $2, active = $3
     WHERE id = $4
     RETURNING *`,
    [payload.category_name, payload.description, payload.active, req.params.id]
  );
  if (!result.rowCount) throw httpError(404, 'Product category not found');
  await logAudit(req, 'update', 'product_category', req.params.id, payload);
  res.json({ category: result.rows[0] });
}));

router.delete('/categories/:id', asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE product_categories SET active = false WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  if (!result.rowCount) throw httpError(404, 'Product category not found');
  await logAudit(req, 'delete', 'product_category', req.params.id, { softDelete: true });
  res.json({ category: result.rows[0] });
}));

router.post('/', asyncHandler(async (req, res) => {
  const payload = productSchema.parse(req.body);
  const result = await query(
    `INSERT INTO products (product_name, category, rate_per_sqft, description, active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, product_name, category, rate_per_sqft, description, active, created_at, updated_at`,
    [payload.product_name, payload.category, payload.rate_per_sqft, payload.description, payload.active]
  );

  res.status(201).json({ product: result.rows[0] });
  await logAudit(req, 'create', 'product', result.rows[0].id, payload);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const payload = productSchema.parse(req.body);
  const result = await query(
    `UPDATE products
     SET product_name = $1, category = $2, rate_per_sqft = $3, description = $4, active = $5
     WHERE id = $6
     RETURNING id, product_name, category, rate_per_sqft, description, active, created_at, updated_at`,
    [
      payload.product_name,
      payload.category,
      payload.rate_per_sqft,
      payload.description,
      payload.active,
      req.params.id
    ]
  );

  if (!result.rowCount) {
    throw httpError(404, 'Product not found');
  }

  res.json({ product: result.rows[0] });
  await logAudit(req, 'update', 'product', req.params.id, payload);
}));

router.patch('/:id/active', asyncHandler(async (req, res) => {
  const payload = z.object({ active: z.boolean() }).parse(req.body);
  const result = await query(
    `UPDATE products SET active = $1 WHERE id = $2
     RETURNING id, product_name, category, rate_per_sqft, description, active, created_at, updated_at`,
    [payload.active, req.params.id]
  );

  if (!result.rowCount) {
    throw httpError(404, 'Product not found');
  }

  res.json({ product: result.rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE products SET active = false WHERE id = $1
     RETURNING id, product_name`,
    [req.params.id]
  );
  if (!result.rowCount) {
    throw httpError(404, 'Product not found');
  }
  await logAudit(req, 'delete', 'product', req.params.id, { softDelete: true });
  res.json({ message: 'Product deactivated' });
}));

module.exports = router;
