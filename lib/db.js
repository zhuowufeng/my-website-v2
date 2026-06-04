// lib/db.js - Final fix: parse URL manually, force no SSL
import { Pool } from 'pg';

function parseConnectionString(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: parseInt(u.port || '5432'),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
    };
  } catch (e) {
    return null;
  }
}

function getConnectionConfig() {
  // Parse DATABASE_URL manually to avoid 'pg' SSL parsing issues
  const url = process.env.DATABASE_URL 
    || process.env.POSTGRES_URL 
    || process.env.POSTGRES_URL_NON_POOLING 
    || process.env.DATABASE_PUBLIC_URL;
  
  if (url) {
    const parsed = parseConnectionString(url);
    if (parsed) {
      console.log('[db] Using parsed connection', { host: parsed.host, port: parsed.port, database: parsed.database });
      return {
        host: parsed.host,
        port: parsed.port,
        user: parsed.user,
        password: parsed.password,
        database: parsed.database,
        ssl: false,
        connectionTimeoutMillis: 10000,
      };
    }
  }
  
  // Fallback: individual PG vars
  if (process.env.PGHOST) {
    return {
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432'),
      user: process.env.PGUSER || process.env.PGUSERNAME,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || process.env.POSTGRES_DATABASE,
      ssl: false,
      connectionTimeoutMillis: 10000,
    };
  }
  
  return { connectionString: undefined };
}

const config = getConnectionConfig();
const pool = new Pool(config);

export function getAvailableDbEnvVars() {
  return ['DATABASE_URL', 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'DATABASE_PUBLIC_URL', 'PGSSLMODE']
    .filter(v => process.env[v] !== undefined);
}

export async function query(text, params) {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    console.log('[db] query ok', { duration: Date.now() - start, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('[db] query error:', err.message, 'envVars:', getAvailableDbEnvVars());
    throw err;
  }
}

export async function getClient() {
  return await pool.connect();
}
