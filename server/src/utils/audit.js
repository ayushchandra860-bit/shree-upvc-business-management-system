const { query } = require('../config/db');

async function logAudit(req, action, entityType, entityId = '', details = {}) {
  try {
    await query(
      `INSERT INTO audit_logs (admin_user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        req.session?.adminUser?.id || null,
        action,
        entityType,
        String(entityId || ''),
        JSON.stringify(details),
        req.ip || ''
      ]
    );
  } catch (error) {
    console.error('Audit log failed', error.message);
  }
}

module.exports = {
  logAudit
};
