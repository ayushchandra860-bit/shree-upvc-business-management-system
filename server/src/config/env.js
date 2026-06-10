const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 10000),
  databaseUrl: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  dbSsl: String(process.env.DB_SSL || 'true').toLowerCase() !== 'false'
};

function requireEnv() {
  const missing = [];
  if (!env.databaseUrl) missing.push('SUPABASE_DATABASE_URL');
  if (!env.sessionSecret) missing.push('SESSION_SECRET');

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
  env,
  requireEnv
};
