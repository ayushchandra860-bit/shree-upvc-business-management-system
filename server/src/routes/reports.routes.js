const express = require('express');
const { z } = require('zod');
const { format, parseISO, startOfMonth, endOfMonth } = require('date-fns');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { query } = require('../config/db');

const router = express.Router();

const reportSchema = z.object({
  report_type: z.enum(['daily_sales', 'monthly_sales', 'customer_wise', 'employee', 'expense', 'revenue', 'profit_loss']),
  date: z.string().optional(),
  month: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  customer_id: z.string().uuid().optional()
});

async function saveSnapshot(payload, data) {
  const result = await query(
    `INSERT INTO report_snapshots (report_type, period_start, period_end, customer_id, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, generated_at`,
    [
      payload.report_type,
      payload.period_start || null,
      payload.period_end || null,
      payload.customer_id || null,
      JSON.stringify(data)
    ]
  );

  return result.rows[0];
}

router.post('/generate', asyncHandler(async (req, res) => {
  const payload = reportSchema.parse(req.body);
  let data;
  let periodStart = null;
  let periodEnd = null;

  if (payload.report_type === 'daily_sales') {
    periodStart = payload.date || format(new Date(), 'yyyy-MM-dd');
    periodEnd = periodStart;
    const invoices = await query(
      `SELECT invoice_number, invoice_date, customer_name, final_amount
       FROM invoices
       WHERE invoice_date = $1::date
       ORDER BY created_at DESC`,
      [periodStart]
    );
    data = {
      title: 'Daily Sales Report',
      invoices: invoices.rows,
      total_sales: invoices.rows.reduce((sum, invoice) => sum + Number(invoice.final_amount), 0),
      invoice_count: invoices.rowCount
    };
  }

  if (payload.report_type === 'monthly_sales') {
    if (!payload.month) {
      throw httpError(400, 'Month is required');
    }
    const monthDate = parseISO(`${payload.month}-01`);
    periodStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    periodEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');
    const invoices = await query(
      `SELECT invoice_number, invoice_date, customer_name, final_amount
       FROM invoices
       WHERE invoice_date BETWEEN $1::date AND $2::date
       ORDER BY invoice_date DESC`,
      [periodStart, periodEnd]
    );
    data = {
      title: 'Monthly Sales Report',
      invoices: invoices.rows,
      total_sales: invoices.rows.reduce((sum, invoice) => sum + Number(invoice.final_amount), 0),
      invoice_count: invoices.rowCount
    };
  }

  if (payload.report_type === 'customer_wise') {
    const params = [];
    let where = '';
    if (payload.customer_id) {
      params.push(payload.customer_id);
      where = 'WHERE i.customer_id = $1';
    }
    const customers = await query(
      `SELECT i.customer_id, i.customer_name, count(*)::int AS invoice_count,
              COALESCE(sum(i.final_amount), 0)::numeric AS total_revenue
       FROM invoices i
       ${where}
       GROUP BY i.customer_id, i.customer_name
       ORDER BY total_revenue DESC`,
      params
    );
    data = {
      title: 'Customer-wise Report',
      customers: customers.rows,
      total_revenue: customers.rows.reduce((sum, item) => sum + Number(item.total_revenue), 0)
    };
  }

  if (payload.report_type === 'revenue') {
    periodStart = payload.from_date || format(startOfMonth(new Date()), 'yyyy-MM-dd');
    periodEnd = payload.to_date || format(new Date(), 'yyyy-MM-dd');
    const revenue = await query(
      `SELECT invoice_date, count(*)::int AS invoice_count,
              COALESCE(sum(final_amount), 0)::numeric AS total_revenue
       FROM invoices
       WHERE invoice_date BETWEEN $1::date AND $2::date
       GROUP BY invoice_date
       ORDER BY invoice_date ASC`,
      [periodStart, periodEnd]
    );
    data = {
      title: 'Revenue Report',
      days: revenue.rows,
      total_revenue: revenue.rows.reduce((sum, item) => sum + Number(item.total_revenue), 0)
    };
  }

  if (payload.report_type === 'employee') {
    const employees = await query(
      `SELECT e.employee_code, e.name, e.designation, e.salary_type, e.base_salary,
              COALESCE(s.pending_salary, 0)::numeric AS pending_salary,
              COALESCE(a.advance_balance, 0)::numeric AS advance_balance
       FROM employees e
       LEFT JOIN (
         SELECT employee_id, sum(net_salary) AS pending_salary
         FROM salaries WHERE status = 'Pending' GROUP BY employee_id
       ) s ON s.employee_id = e.id
       LEFT JOIN (
         SELECT employee_id, sum(amount - deducted_amount) AS advance_balance
         FROM employee_advances GROUP BY employee_id
       ) a ON a.employee_id = e.id
       ORDER BY e.name ASC`
    );
    data = { title: 'Employee Report', employees: employees.rows };
  }

  if (payload.report_type === 'expense') {
    periodStart = payload.from_date || format(startOfMonth(new Date()), 'yyyy-MM-dd');
    periodEnd = payload.to_date || format(new Date(), 'yyyy-MM-dd');
    const expenses = await query(
      `SELECT category, count(*)::int AS expense_count, COALESCE(sum(amount), 0)::numeric AS total_amount
       FROM expenses
       WHERE expense_date BETWEEN $1::date AND $2::date
       GROUP BY category
       ORDER BY total_amount DESC`,
      [periodStart, periodEnd]
    );
    data = {
      title: 'Expense Report',
      expenses: expenses.rows,
      total_expenses: expenses.rows.reduce((sum, item) => sum + Number(item.total_amount), 0)
    };
  }

  if (payload.report_type === 'profit_loss') {
    periodStart = payload.from_date || format(startOfMonth(new Date()), 'yyyy-MM-dd');
    periodEnd = payload.to_date || format(new Date(), 'yyyy-MM-dd');
    const [revenue, expenses, salaries] = await Promise.all([
      query('SELECT COALESCE(sum(final_amount), 0)::numeric AS total FROM invoices WHERE invoice_date BETWEEN $1::date AND $2::date', [periodStart, periodEnd]),
      query('SELECT COALESCE(sum(amount), 0)::numeric AS total FROM expenses WHERE expense_date BETWEEN $1::date AND $2::date', [periodStart, periodEnd]),
      query(`SELECT COALESCE(sum(net_salary), 0)::numeric AS total FROM salaries WHERE status = 'Paid' AND paid_date BETWEEN $1::date AND $2::date`, [periodStart, periodEnd])
    ]);
    const totalRevenue = Number(revenue.rows[0].total);
    const totalExpenses = Number(expenses.rows[0].total) + Number(salaries.rows[0].total);
    data = {
      title: 'Profit & Loss Report',
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_profit: totalRevenue - totalExpenses
    };
  }

  const snapshot = await saveSnapshot(
    {
      report_type: payload.report_type,
      period_start: periodStart,
      period_end: periodEnd,
      customer_id: payload.customer_id
    },
    data
  );

  res.status(201).json({ report: data, snapshot });
}));

router.get('/snapshots', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, report_type, period_start, period_end, generated_at
     FROM report_snapshots
     ORDER BY generated_at DESC
     LIMIT 30`
  );

  res.json({ snapshots: result.rows });
}));

module.exports = router;
