const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { Pool, types } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();
types.setTypeParser(1700, (value) => Number(value));

const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const name = process.env.ADMIN_NAME || 'Admin';
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!databaseUrl || !email || !password) {
  console.error('SUPABASE_DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD are required.');
  process.exit(1);
}

if (password.length < 12) {
  console.error('ADMIN_PASSWORD must be at least 12 characters.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: String(process.env.DB_SSL || 'true').toLowerCase() !== 'false'
    ? { rejectUnauthorized: false }
    : false
});

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await pool.query(
    'SELECT id FROM admin_users WHERE lower(email) = lower($1)',
    [email]
  );

  if (existing.rowCount) {
    await pool.query(
      `UPDATE admin_users
       SET name = $1, password_hash = $2, active = true
       WHERE id = $3`,
      [name, passwordHash, existing.rows[0].id]
    );
    console.log(`Updated admin user: ${email}`);
  } else {
    await pool.query(
      `INSERT INTO admin_users (name, email, password_hash)
       VALUES ($1, $2, $3)`,
      [name, email, passwordHash]
    );
    console.log(`Created admin user: ${email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
