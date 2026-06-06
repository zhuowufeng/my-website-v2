// scripts/init-db.js
// Database initialization script — runs on deploy via "start" hook
// Module 4 validation: deployment & DevOps

import { query, getAvailableDbEnvVars, pool } from '../lib/db.js';

async function initDatabase() {
  console.log('=== Database Initialization ===');
  console.log(`[init] ${new Date().toISOString()}`);

  // Check DB connection
  try {
    const result = await query('SELECT version()', []);
    console.log(`[init] Connected: ${result.rows[0].version.substring(0, 40)}...`);
  } catch (err) {
    console.error('[init] FAILED to connect to database');
    console.error(`[init] Available env vars: ${getAvailableDbEnvVars().join(', ') || 'NONE'}`);
    throw err;
  }

  // Initialize tables in order
  const tables = [
    {
      name: 'users',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          identifier VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          free_usage_today INT DEFAULT 0,
          subscription_type VARCHAR(50) DEFAULT 'free',
          subscription_expires_at TIMESTAMP,
          extra_credits INT DEFAULT 0
        );
      `,
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_users_identifier ON users(identifier);',
        'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);',
      ],
    },
    {
      name: 'name_history',
      sql: `
        CREATE TABLE IF NOT EXISTS name_history (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          english_name VARCHAR(100) NOT NULL,
          gender VARCHAR(10) DEFAULT 'any',
          results JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_name_history_user_id ON name_history(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_name_history_created_at ON name_history(created_at);',
      ],
    },
    {
      name: 'articles',
      sql: `
        CREATE TABLE IF NOT EXISTS articles (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          topic VARCHAR(500) NOT NULL,
          article_type VARCHAR(50) NOT NULL DEFAULT 'blog',
          title VARCHAR(300),
          content TEXT NOT NULL,
          word_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at);',
        'CREATE INDEX IF NOT EXISTS idx_articles_topic ON articles USING gin(to_tsvector(\'simple\', topic));',
      ],
    },
  ];

  for (const table of tables) {
    try {
      await query(table.sql, []);
      console.log(`[init] Table "${table.name}" ready`);

      for (const indexSql of table.indexes) {
        try {
          await query(indexSql, []);
        } catch {
          // Index may already exist
        }
      }
    } catch (err) {
      console.error(`[init] Failed to create table "${table.name}":`, err.message);
      throw err;
    }
  }

  console.log('=== Database initialization complete ===');
}

// Run init and close pool
initDatabase()
  .then(() => {
    console.log('[init] Done. Closing pool.');
    return pool.end();
  })
  .catch((err) => {
    console.error('[init] Fatal error:', err);
    process.exit(1);
  });
