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

async function ensureSettingsRow() {
  await query(
    `INSERT INTO company_settings (id)
     VALUES (true)
     ON CONFLICT (id) DO NOTHING`
  );
}

router.get('/', asyncHandler(async (req, res) => {
  await ensureSettingsRow();
  const result = await query('SELECT * FROM company_settings WHERE id = true');
  res.json({ settings: result.rows[0] });
}));

router.put('/', asyncHandler(async (req, res) => {
  const payload = settingsSchema.parse(req.body);
  await ensureSettingsRow();
  const result = await query(
    `INSERT INTO company_settings (
       id, company_name, logo_url, gst_number, address, mobile_number, email, bank_details,
       qr_code_url, signature_url, bank_name, account_number, ifsc, upi_id,
       terms_conditions, authorized_signature, theme_mode, primary_color, sidebar_color
     )
     VALUES (
       true, $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12, $13,
       $14, $15, $16, $17, $18
     )
     ON CONFLICT (id) DO UPDATE
     SET company_name = EXCLUDED.company_name,
         logo_url = EXCLUDED.logo_url,
         gst_number = EXCLUDED.gst_number,
         address = EXCLUDED.address,
         mobile_number = EXCLUDED.mobile_number,
         email = EXCLUDED.email,
         bank_details = EXCLUDED.bank_details,
         qr_code_url = EXCLUDED.qr_code_url,
         signature_url = EXCLUDED.signature_url,
         bank_name = EXCLUDED.bank_name,
         account_number = EXCLUDED.account_number,
         ifsc = EXCLUDED.ifsc,
         upi_id = EXCLUDED.upi_id,
         terms_conditions = EXCLUDED.terms_conditions,
         authorized_signature = EXCLUDED.authorized_signature,
         theme_mode = EXCLUDED.theme_mode,
         primary_color = EXCLUDED.primary_color,
         sidebar_color = EXCLUDED.sidebar_color,
         updated_at = now()
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
