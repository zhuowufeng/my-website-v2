// lib/db.js
import { Pool } from 'pg';

// Try multiple connection strategies
function getConnectionConfig() {
  // Determine SSL mode from env var
  const pgssl = (process.env.PGSSLMODE || '').toLowerCase();
  const useSSL = pgssl === 'require' || pgssl === 'verify-ca' || pgssl === 'verify-full';
  
  // Log config info (no secrets)
  console.log('[db] PGSSLMODE=' + process.env.PGSSLMODE + ' hasDBURL=' + !!process.env.DATABASE_URL + ' useSSL=' + useSSL);
  
  // 1. Direct DATABASE_URL
  if (process.env.DATABASE_URL) {
    // Only add ssl config if explicitly enabled via PGSSLMODE
    if (useSSL) {
      return { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } };
    }
    // No SSL config -> pg defaults to no SSL
    return { connectionString: process.env.DATABASE_URL };
  }
  
  // 2. Individual PG env vars (Zeabur auto-inject)
  if (process.env.PGHOST) {
    const config = {
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432'),
      user: process.env.PGUSER || process.env.PGUSERNAME,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
    };
    if (useSSL) {
      config.ssl = { rejectUnauthorized: false };
    }
    return config;
  }
  
  // 3. Common cloud platform env vars
  const url = process.env.DATABASE_URL 
    || process.env.POSTGRES_URL 
    || process.env.POSTGRES_URL_NON_POOLING 
    || process.env.DATABASE_PUBLIC_URL;
  if (url) {
    if (useSSL) {
      return { connectionString: url, ssl: { rejectUnauthorized: false } };
    }
    return { connectionString: url };
  }
  
  // 4. Fallback: use nothing (will fail gracefully)
  return { connectionString: undefined };
}

const config = getConnectionConfig();

// Export available env var names for debugging (no values for security)
export function getAvailableDbEnvVars() {
  const vars = ['DATABASE_URL', 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'DATABASE_PUBLIC_URL', 'PGSSLMODE'];
  return vars.filter(v => process.env[v] !== undefined);
}

const pool = new Pool(config);

export async function query(text, params) {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('query error:', err.message, 'envVars:', getAvailableDbEnvVars());
    throw err;
  }
}

export async function getClient() {
  return await pool.connect();
}
