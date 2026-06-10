const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { query } = require('../config/db');
const { logAudit } = require('../utils/audit');

const router = express.Router();

const categories = [
  'Material Purchase',
  'Glass Purchase',
  'Hardware Purchase',
  'Salary Expenses',
  'Transportation',
  'Electricity',
  'Rent',
  'Misc Expenses'
];

const expenseSchema = z.object({
  expense_date: z.string().optional(),
  category: z.enum(categories),
  amount: z.coerce.number().positive(),
  paid_to: z.string().trim().optional().default(''),
  payment_mode: z.string().trim().optional().default('Cash'),
  notes: z.string().trim().optional().default('')
});

router.get('/', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT * FROM expenses
     ORDER BY expense_date DESC, created_at DESC
     LIMIT 300`
  );
  res.json({ expenses: result.rows, categories });
}));

router.post('/', asyncHandler(async (req, res) => {
  const payload = expenseSchema.parse(req.body);
  const result = await query(
    `INSERT INTO expenses (expense_date, category, amount, paid_to, payment_mode, notes, created_by)
     VALUES (COALESCE($1::date, current_date), $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [payload.expense_date || null, payload.category, payload.amount, payload.paid_to, payload.payment_mode, payload.notes, req.session.adminUser.id]
  );
  await logAudit(req, 'create', 'expense', result.rows[0].id, payload);
  res.status(201).json({ expense: result.rows[0] });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const payload = expenseSchema.parse(req.body);
  const result = await query(
    `UPDATE expenses
     SET expense_date = COALESCE($1::date, expense_date), category = $2, amount = $3,
         paid_to = $4, payment_mode = $5, notes = $6
     WHERE id = $7
     RETURNING *`,
    [payload.expense_date || null, payload.category, payload.amount, payload.paid_to, payload.payment_mode, payload.notes, req.params.id]
  );
  if (!result.rowCount) throw httpError(404, 'Expense not found');
  await logAudit(req, 'update', 'expense', req.params.id, payload);
  res.json({ expense: result.rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM expenses WHERE id = $1 RETURNING id', [req.params.id]);
  if (!result.rowCount) throw httpError(404, 'Expense not found');
  await logAudit(req, 'delete', 'expense', req.params.id);
  res.json({ message: 'Expense deleted' });
}));

module.exports = router;
