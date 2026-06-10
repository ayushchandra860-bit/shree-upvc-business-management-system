const express = require('express');
const zlib = require('zlib');
const asyncHandler = require('../utils/asyncHandler');
const { query, withTransaction } = require('../config/db');
const { logAudit } = require('../utils/audit');

const router = express.Router();

const backupTables = [
  'customers',
  'products',
  'product_categories',
  'quotations',
  'quotation_items',
  'orders',
  'invoices',
  'invoice_items',
  'payments',
  'employees',
  'attendance',
  'salaries',
  'employee_advances',
  'expenses',
  'suppliers',
  'supplier_payments',
  'company_settings'
];

const restoreOrder = [
  'company_settings',
  'product_categories',
  'products',
  'customers',
  'quotations',
  'quotation_items',
  'orders',
  'invoices',
  'invoice_items',
  'payments',
  'employees',
  'attendance',
  'employee_advances',
  'salaries',
  'suppliers',
  'supplier_payments',
  'expenses'
];

async function collectBackup() {
  const data = {};
  for (const table of backupTables) {
    const result = await query(`SELECT * FROM ${table}`);
    data[table] = result.rows;
  }
  return {
    company: 'SHREE UPVC WINDOWS & DOORS',
    generated_at: new Date().toISOString(),
    tables: backupTables,
    data
  };
}

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function makeZip(fileName, content) {
  const name = Buffer.from(fileName);
  const data = Buffer.from(content);
  const compressed = zlib.deflateRawSync(data);
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(0, 10);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(0, 12);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);

  const end = Buffer.alloc(22);
  const centralSize = central.length + name.length;
  const centralOffset = local.length + name.length + compressed.length;
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, name, compressed, central, name, end]);
}

function toSpreadsheetHtml(backup) {
  return `<!doctype html><html><body>${backupTables.map((table) => {
    const rows = backup.data[table] || [];
    const columns = rows[0] ? Object.keys(rows[0]) : [];
    return `<h2>${table}</h2><table border="1"><thead><tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${String(row[column] ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }).join('')}</body></html>`;
}

async function recordBackup(req, format, fileName) {
  await query(
    `INSERT INTO backup_history (backup_type, export_format, status, file_name, included_tables, created_by)
     VALUES ('Manual', $1, 'Completed', $2, $3, $4)`,
    [format, fileName, backupTables, req.session.adminUser.id]
  );
}

router.get('/history', asyncHandler(async (req, res) => {
  const history = await query('SELECT * FROM backup_history ORDER BY created_at DESC LIMIT 50');
  res.json({ history: history.rows, lastBackup: history.rows[0] || null, tables: backupTables });
}));

router.get('/export/json', asyncHandler(async (req, res) => {
  const backup = await collectBackup();
  const fileName = `shree-upvc-backup-${Date.now()}.json`;
  await recordBackup(req, 'JSON', fileName);
  await logAudit(req, 'export', 'backup', fileName);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.json(backup);
}));

router.get('/export/zip', asyncHandler(async (req, res) => {
  const backup = await collectBackup();
  const fileName = `shree-upvc-backup-${Date.now()}.zip`;
  const zip = makeZip('backup.json', JSON.stringify(backup, null, 2));
  await recordBackup(req, 'ZIP', fileName);
  await logAudit(req, 'export', 'backup', fileName);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.end(zip);
}));

router.get('/export/excel', asyncHandler(async (req, res) => {
  const backup = await collectBackup();
  const fileName = `shree-upvc-backup-${Date.now()}.xls`;
  await recordBackup(req, 'Excel', fileName);
  await logAudit(req, 'export', 'backup', fileName);
  res.setHeader('Content-Type', 'application/vnd.ms-excel');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(toSpreadsheetHtml(backup));
}));

router.post('/restore', asyncHandler(async (req, res) => {
  const backup = req.body;
  const beforeRestore = await collectBackup();
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO backup_history (backup_type, export_format, status, file_name, included_tables, created_by)
       VALUES ('Before Restore', 'JSON', 'Completed', $1, $2, $3)`,
      [`before-restore-${Date.now()}.json`, backupTables, req.session.adminUser.id]
    );

    for (const table of [...restoreOrder].reverse()) {
      await client.query(`DELETE FROM ${table}`);
    }
    for (const table of restoreOrder) {
      const rows = backup.data?.[table] || [];
      for (const row of rows) {
        const columns = Object.keys(row);
        if (!columns.length) continue;
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
        await client.query(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          columns.map((column) => row[column])
        );
      }
    }
  });
  await logAudit(req, 'restore', 'backup', '', { generated_at: backup.generated_at, beforeRestore: beforeRestore.generated_at });
  res.json({ message: 'Backup restored successfully' });
}));

module.exports = router;
