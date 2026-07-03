const { Pool, types } = require('pg');
const { env } = require('./env');

types.setTypeParser(1700, (value) => Number(value));

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function nextNumber(client, sequenceType) {
  const sequence = await client.query(
    'SELECT prefix, current_value FROM number_sequences WHERE sequence_type = $1 FOR UPDATE',
    [sequenceType]
  );

  if (!sequence.rowCount) {
    throw new Error(`Number sequence not configured: ${sequenceType}`);
  }

  const nextValue = Number(sequence.rows[0].current_value) + 1;
  await client.query(
    'UPDATE number_sequences SET current_value = $1, updated_at = now() WHERE sequence_type = $2',
    [nextValue, sequenceType]
  );

  return `${sequence.rows[0].prefix}-${new Date().getFullYear()}-${String(nextValue).padStart(5, '0')}`;
}

async function getCompanySettings() {
  const result = await query('SELECT * FROM company_settings WHERE id = true');
  return result.rows[0] || {};
}

module.exports = {
  pool,
  query,
  withTransaction,
  nextNumber,
  getCompanySettings
};
