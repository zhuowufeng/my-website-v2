// lib/db.js
import { Pool } from 'pg';

// Determine SSL mode from env var or defaults
function getSslConfig() {
  const mode = (process.env.PGSSLMODE || '').toLowerCase();
  
  // PGSSLMODE=disable → no SSL
  if (mode === 'disable') {
    return false;
  }
  
  // PGSSLMODE=require, verify-ca, verify-full → with SSL
  if (mode && mode !== 'prefer') {
    return { rejectUnauthorized: false };
  }
  
  // Default (prefer): try without SSL first
  // Most cloud Postgres (Neon, Supabase, etc.) require SSL,
  // but local/Zeabur-native ones often don't support it.
  // We default to no SSL and let specific env override.
  return false;
}

// Try multiple connection strategies
function getConnectionConfig() {
  const ssl = getSslConfig();
  
  // 1. Direct DATABASE_URL
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl };
  }
  // 2. Individual PG env vars (Zeabur auto-inject)
  if (process.env.PGHOST) {
    return {
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432'),
      user: process.env.PGUSER || process.env.PGUSERNAME,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl,
    };
  }
  // 3. Common cloud platform env vars
  const url = process.env.DATABASE_URL 
    || process.env.POSTGRES_URL 
    || process.env.POSTGRES_URL_NON_POOLING 
    || process.env.DATABASE_PUBLIC_URL;
  if (url) {
    return { connectionString: url, ssl };
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
