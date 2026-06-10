const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { query, withTransaction, nextNumber } = require('../config/db');
const { logAudit } = require('../utils/audit');

const router = express.Router();

const employeeSchema = z.object({
  name: z.string().trim().min(2),
  mobile: z.string().trim().min(10),
  address: z.string().trim().optional().default(''),
  aadhaar: z.string().trim().optional().default(''),
  joining_date: z.string().optional(),
  designation: z.string().trim().optional().default(''),
  salary_type: z.enum(['Monthly', 'Daily', 'Hourly']).default('Monthly'),
  base_salary: z.coerce.number().min(0).default(0),
  active: z.boolean().optional().default(true)
});

router.get('/', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT e.*,
            COALESCE(a.advance_balance, 0)::numeric AS advance_balance
     FROM employees e
     LEFT JOIN (
       SELECT employee_id, sum(amount - deducted_amount) AS advance_balance
       FROM employee_advances
       GROUP BY employee_id
     ) a ON a.employee_id = e.id
     ORDER BY e.created_at DESC`
  );
  res.json({ employees: result.rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const payload = employeeSchema.parse(req.body);
  const employee = await withTransaction(async (client) => {
    const code = await nextNumber(client, 'employee');
    const result = await client.query(
      `INSERT INTO employees (
         employee_code, name, mobile, address, aadhaar, joining_date,
         designation, salary_type, base_salary, active
       )
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, current_date), $7, $8, $9, $10)
       RETURNING *`,
      [
        code,
        payload.name,
        payload.mobile,
        payload.address,
        payload.aadhaar,
        payload.joining_date || null,
        payload.designation,
        payload.salary_type,
        payload.base_salary,
        payload.active
      ]
    );
    return result.rows[0];
  });
  await logAudit(req, 'create', 'employee', employee.id, payload);
  res.status(201).json({ employee });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const payload = employeeSchema.parse(req.body);
  const result = await query(
    `UPDATE employees
     SET name = $1, mobile = $2, address = $3, aadhaar = $4,
         joining_date = COALESCE($5::date, joining_date), designation = $6,
         salary_type = $7, base_salary = $8, active = $9
     WHERE id = $10
     RETURNING *`,
    [
      payload.name,
      payload.mobile,
      payload.address,
      payload.aadhaar,
      payload.joining_date || null,
      payload.designation,
      payload.salary_type,
      payload.base_salary,
      payload.active,
      req.params.id
    ]
  );
  if (!result.rowCount) throw httpError(404, 'Employee not found');
  await logAudit(req, 'update', 'employee', req.params.id, payload);
  res.json({ employee: result.rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await query('UPDATE employees SET active = false WHERE id = $1 RETURNING id', [req.params.id]);
  if (!result.rowCount) throw httpError(404, 'Employee not found');
  await logAudit(req, 'delete', 'employee', req.params.id, { softDelete: true });
  res.json({ message: 'Employee deactivated' });
}));

router.get('/:id/history', asyncHandler(async (req, res) => {
  const [attendance, advances, salaries] = await Promise.all([
    query('SELECT * FROM attendance WHERE employee_id = $1 ORDER BY attendance_date DESC LIMIT 60', [req.params.id]),
    query('SELECT *, (amount - deducted_amount) AS remaining_deduction FROM employee_advances WHERE employee_id = $1 ORDER BY advance_date DESC', [req.params.id]),
    query('SELECT * FROM salaries WHERE employee_id = $1 ORDER BY salary_month DESC', [req.params.id])
  ]);
  res.json({ attendance: attendance.rows, advances: advances.rows, salaries: salaries.rows });
}));

router.post('/attendance', asyncHandler(async (req, res) => {
  const payload = z.object({
    employee_id: z.string().uuid(),
    attendance_date: z.string(),
    status: z.enum(['Present', 'Absent', 'Half Day', 'Leave']),
    notes: z.string().trim().optional().default('')
  }).parse(req.body);
  const result = await query(
    `INSERT INTO attendance (employee_id, attendance_date, status, notes)
     VALUES ($1, $2::date, $3, $4)
     ON CONFLICT (employee_id, attendance_date)
     DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes
     RETURNING *`,
    [payload.employee_id, payload.attendance_date, payload.status, payload.notes]
  );
  await logAudit(req, 'upsert', 'attendance', result.rows[0].id, payload);
  res.status(201).json({ attendance: result.rows[0] });
}));

router.get('/attendance/monthly/:month', asyncHandler(async (req, res) => {
  const month = req.params.month;
  const result = await query(
    `SELECT e.employee_code, e.name,
            count(*) FILTER (WHERE a.status = 'Present')::int AS present_days,
            count(*) FILTER (WHERE a.status = 'Absent')::int AS absent_days,
            count(*) FILTER (WHERE a.status = 'Half Day')::int AS half_days,
            count(*) FILTER (WHERE a.status = 'Leave')::int AS leave_days
     FROM employees e
     LEFT JOIN attendance a ON a.employee_id = e.id AND to_char(a.attendance_date, 'YYYY-MM') = $1
     GROUP BY e.employee_code, e.name
     ORDER BY e.name ASC`,
    [month]
  );
  res.json({ report: result.rows });
}));

router.post('/advances', asyncHandler(async (req, res) => {
  const payload = z.object({
    employee_id: z.string().uuid(),
    advance_date: z.string().optional(),
    amount: z.coerce.number().positive(),
    reason: z.string().trim().optional().default('')
  }).parse(req.body);
  const result = await query(
    `INSERT INTO employee_advances (employee_id, advance_date, amount, reason)
     VALUES ($1, COALESCE($2::date, current_date), $3, $4)
     RETURNING *, (amount - deducted_amount) AS remaining_deduction`,
    [payload.employee_id, payload.advance_date || null, payload.amount, payload.reason]
  );
  await logAudit(req, 'create', 'employee_advance', result.rows[0].id, payload);
  res.status(201).json({ advance: result.rows[0] });
}));

router.post('/salaries/calculate', asyncHandler(async (req, res) => {
  const payload = z.object({
    employee_id: z.string().uuid(),
    salary_month: z.string(),
    gross_salary: z.coerce.number().min(0).optional(),
    status: z.enum(['Paid', 'Pending']).optional().default('Pending'),
    notes: z.string().trim().optional().default('')
  }).parse(req.body);

  const salary = await withTransaction(async (client) => {
    const employee = await client.query('SELECT * FROM employees WHERE id = $1', [payload.employee_id]);
    if (!employee.rowCount) throw httpError(404, 'Employee not found');

    const attendance = await client.query(
      `SELECT count(*) FILTER (WHERE status = 'Present')::int AS present_days,
              count(*) FILTER (WHERE status = 'Half Day')::int AS half_days
       FROM attendance
       WHERE employee_id = $1 AND to_char(attendance_date, 'YYYY-MM') = $2`,
      [payload.employee_id, payload.salary_month]
    );
    const advance = await client.query(
      `SELECT COALESCE(sum(amount - deducted_amount), 0)::numeric AS balance
       FROM employee_advances WHERE employee_id = $1`,
      [payload.employee_id]
    );

    const base = Number(employee.rows[0].base_salary || 0);
    const present = Number(attendance.rows[0].present_days || 0);
    const half = Number(attendance.rows[0].half_days || 0);
    const calculatedGross = employee.rows[0].salary_type === 'Monthly'
      ? base
      : base * (present + half * 0.5);
    const gross = Number(payload.gross_salary ?? calculatedGross);
    const advanceDeduction = Math.min(Number(advance.rows[0].balance || 0), gross);
    const net = Math.max(gross - advanceDeduction, 0);

    const result = await client.query(
      `INSERT INTO salaries (employee_id, salary_month, gross_salary, advance_deduction, net_salary, status, paid_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 = 'Paid' THEN current_date ELSE NULL END, $7)
       ON CONFLICT (employee_id, salary_month)
       DO UPDATE SET gross_salary = EXCLUDED.gross_salary,
                     advance_deduction = EXCLUDED.advance_deduction,
                     net_salary = EXCLUDED.net_salary,
                     status = EXCLUDED.status,
                     paid_date = EXCLUDED.paid_date,
                     notes = EXCLUDED.notes
       RETURNING *`,
      [payload.employee_id, payload.salary_month, gross, advanceDeduction, net, payload.status, payload.notes]
    );

    return result.rows[0];
  });

  await logAudit(req, 'calculate', 'salary', salary.id, payload);
  res.status(201).json({ salary });
}));

module.exports = router;
