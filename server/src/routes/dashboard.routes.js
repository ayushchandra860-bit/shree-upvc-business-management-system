const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { query } = require('../config/db');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const [
    customers,
    quotations,
    orders,
    invoices,
    pendingInstallations,
    completedInstallations,
    monthlyRevenue,
    pendingPayments,
    pendingSalaries,
    totalExpenses,
    recentQuotations,
    recentOrders,
    recentActivity
  ] = await Promise.all([
    query('SELECT count(*)::int AS total FROM customers'),
    query('SELECT count(*)::int AS total FROM quotations'),
    query('SELECT count(*)::int AS total FROM orders'),
    query('SELECT count(*)::int AS total FROM invoices'),
    query(
      `SELECT count(*)::int AS total
       FROM orders
       WHERE status IN ('Order Confirmed', 'Manufacturing', 'Installation Scheduled')`
    ),
    query(
      `SELECT count(*)::int AS total
       FROM orders
       WHERE status = 'Installation Completed'`
    ),
    query(
      `SELECT COALESCE(sum(final_amount), 0)::numeric AS total
       FROM invoices
       WHERE invoice_date >= date_trunc('month', current_date)
         AND invoice_date < date_trunc('month', current_date) + interval '1 month'`
    ),
    query(`SELECT COALESCE(sum(remaining_amount), 0)::numeric AS total FROM invoices WHERE payment_status <> 'Paid'`),
    query(`SELECT COALESCE(sum(net_salary), 0)::numeric AS total FROM salaries WHERE status = 'Pending'`),
    query(
      `SELECT COALESCE(sum(amount), 0)::numeric AS total
       FROM expenses
       WHERE expense_date >= date_trunc('month', current_date)
         AND expense_date < date_trunc('month', current_date) + interval '1 month'`
    ),
    query(
      `SELECT id, quotation_number, quotation_date, customer_name, mobile_number, status, grand_total
       FROM quotations
       ORDER BY created_at DESC
       LIMIT 6`
    ),
    query(
      `SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at,
              q.quotation_number, c.customer_name
       FROM orders o
       LEFT JOIN quotations q ON q.id = o.quotation_id
       LEFT JOIN customers c ON c.id = o.customer_id
       ORDER BY o.created_at DESC
       LIMIT 6`
    ),
    query(
      `SELECT action, entity_type, created_at
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT 8`
    )
  ]);

  res.json({
    stats: {
      totalCustomers: customers.rows[0].total,
      totalQuotations: quotations.rows[0].total,
      totalOrders: orders.rows[0].total,
      totalInvoices: invoices.rows[0].total,
      pendingInstallations: pendingInstallations.rows[0].total,
      completedInstallations: completedInstallations.rows[0].total,
      monthlyRevenue: Number(monthlyRevenue.rows[0].total),
      pendingPayments: Number(pendingPayments.rows[0].total),
      pendingSalaries: Number(pendingSalaries.rows[0].total),
      totalExpenses: Number(totalExpenses.rows[0].total),
      netProfit: Number(monthlyRevenue.rows[0].total) - Number(totalExpenses.rows[0].total)
    },
    recentQuotations: recentQuotations.rows,
    recentOrders: recentOrders.rows,
    recentActivity: recentActivity.rows
  });
}));

module.exports = router;
