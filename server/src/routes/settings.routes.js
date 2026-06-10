const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { query } = require('../config/db');
const { logAudit } = require('../utils/audit');

const router = express.Router();

const settingsSchema = z.object({
  company_name: z.string().trim().min(2),
  logo_url: z.string().trim().optional().default(''),
  gst_number: z.string().trim().optional().default(''),
  address: z.string().trim().min(5),
  mobile_number: z.string().trim().optional().default(''),
  email: z.string().trim().optional().default(''),
  bank_details: z.string().trim().optional().default(''),
  qr_code_url: z.string().trim().optional().default(''),
  signature_url: z.string().trim().optional().default(''),
  bank_name: z.string().trim().optional().default(''),
  account_number: z.string().trim().optional().default(''),
  ifsc: z.string().trim().optional().default(''),
  upi_id: z.string().trim().optional().default(''),
  terms_conditions: z.string().trim().optional().default(''),
  authorized_signature: z.string().trim().optional().default('Authorized Signatory'),
  theme_mode: z.enum(['light', 'dark']).optional().default('light'),
  primary_color: z.string().trim().optional().default('#0b2d5c'),
  sidebar_color: z.string().trim().optional().default('#0b2d5c')
});

router.get('/', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM company_settings WHERE id = true');
  res.json({ settings: result.rows[0] });
}));

router.put('/', asyncHandler(async (req, res) => {
  const payload = settingsSchema.parse(req.body);
  const result = await query(
    `UPDATE company_settings
     SET company_name = $1, logo_url = $2, gst_number = $3, address = $4,
         mobile_number = $5, email = $6, bank_details = $7, qr_code_url = $8,
         signature_url = $9, bank_name = $10, account_number = $11, ifsc = $12, upi_id = $13,
         terms_conditions = $14, authorized_signature = $15, theme_mode = $16,
         primary_color = $17, sidebar_color = $18, updated_at = now()
     WHERE id = true
     RETURNING *`,
    [
      payload.company_name,
      payload.logo_url,
      payload.gst_number,
      payload.address,
      payload.mobile_number,
      payload.email,
      payload.bank_details,
      payload.qr_code_url,
      payload.signature_url,
      payload.bank_name,
      payload.account_number,
      payload.ifsc,
      payload.upi_id,
      payload.terms_conditions,
      payload.authorized_signature,
      payload.theme_mode,
      payload.primary_color,
      payload.sidebar_color
    ]
  );
  await logAudit(req, 'update', 'settings', 'company', payload);
  res.json({ settings: result.rows[0] });
}));

module.exports = router;
