// scripts/init-db.js
// Database initialization script — runs on deploy via "start" hook
// Module 4 validation: deployment & DevOps
// 
// NOTE: If DB is not available, we gracefully log a warning and exit cleanly
// so the server can still start (some features just won't work without DB).

import { query, getAvailableDbEnvVars } from '../lib/db.js';

async function initDatabase() {
  console.log('=== Database Initialization ===');
  console.log(`[init] ${new Date().toISOString()}`);

  // Check DB connection
  try {
    const result = await query('SELECT version()', []);
    console.log(`[init] Connected: ${result.rows[0].version.substring(0, 40)}...`);
  } catch (err) {
    console.error('[init] ⚠️ Database not available — skipping table creation');
    console.error(`[init] Error: ${err.message}`);
    console.error(`[init] Available env vars: ${getAvailableDbEnvVars().join(', ') || 'NONE'}`);
    console.error('[init] Site will start WITHOUT database features.');
    console.error('[init] To fix: set DATABASE_URL in Zeabur environment variables.');
    // Graceful exit — let the server start anyway
    process.exit(0);
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
          extra_credits INT DEFAULT 0,
          stripe_customer_id VARCHAR(255),
          stripe_subscription_id VARCHAR(255),
          stripe_subscription_status VARCHAR(50) DEFAULT 'incomplete'
        );
      `,
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_users_identifier ON users(identifier);',
        'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);',
        'CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);',
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
        'CREATE INDEX IF NOT EXISTS idx_name_history_user_created ON name_history(user_id, created_at DESC);',
      ],
    },
    {
      name: 'articles',
      sql: `
        CREATE TABLE IF NOT EXISTS articles (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          title VARCHAR(500) NOT NULL,
          content TEXT NOT NULL,
          article_type VARCHAR(50) DEFAULT 'blog',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at);',
        'CREATE INDEX IF NOT EXISTS idx_articles_user_created ON articles(user_id, created_at DESC);',
      ],
    },
    {
      name: 'blog_posts',
      sql: `
        CREATE TABLE IF NOT EXISTS blog_posts (
          id SERIAL PRIMARY KEY,
          slug VARCHAR(255) UNIQUE NOT NULL,
          title VARCHAR(500) NOT NULL,
          content TEXT NOT NULL,
          excerpt TEXT,
          category VARCHAR(100),
          tags TEXT[],
          published BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);',
        'CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published, created_at DESC);',
        'CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);',
      ],
    },
    {
      name: 'seo_history',
      sql: `
        CREATE TABLE IF NOT EXISTS seo_history (
          id SERIAL PRIMARY KEY,
          url TEXT NOT NULL,
          user_id INTEGER REFERENCES users(id),
          score INTEGER NOT NULL,
          grade VARCHAR(2) NOT NULL,
          checks JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_seo_history_user_id ON seo_history(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_seo_history_created_at ON seo_history(created_at);',
        'CREATE INDEX IF NOT EXISTS idx_seo_history_user_created ON seo_history(user_id, created_at DESC);',
        'CREATE INDEX IF NOT EXISTS idx_seo_history_url ON seo_history(url);',
      ],
    },
    {
      name: 'search_index',
      sql: `
        CREATE TABLE IF NOT EXISTS search_index (
          id SERIAL PRIMARY KEY,
          page_url TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT DEFAULT 'general',
          keywords TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_search_index_url ON search_index(page_url);',
        'CREATE INDEX IF NOT EXISTS idx_search_index_category ON search_index(category);',
      ],
    },
    {
      name: 'keyword_research',
      sql: `
        CREATE TABLE IF NOT EXISTS keyword_research (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          seed_keyword VARCHAR(255) NOT NULL,
          results JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_keyword_research_user_id ON keyword_research(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_keyword_research_created_at ON keyword_research(created_at);',
        'CREATE INDEX IF NOT EXISTS idx_kw_research_user_created ON keyword_research(user_id, created_at DESC);',
      ],
    },
    {
      name: 'page_views',
      sql: `
        CREATE TABLE IF NOT EXISTS page_views (
          id SERIAL PRIMARY KEY,
          page TEXT NOT NULL,
          referrer TEXT,
          user_agent TEXT,
          ip_hash TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_page_views_page ON page_views(page);',
        'CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);',
      ],
    },
    {
      name: 'competitor_analyses',
      sql: `
        CREATE TABLE IF NOT EXISTS competitor_analyses (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          urls JSONB NOT NULL,
          result_json JSONB NOT NULL,
          analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_comp_analyses_user_id ON competitor_analyses(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_comp_analyses_analyzed_at ON competitor_analyses(analyzed_at);',
        'CREATE INDEX IF NOT EXISTS idx_comp_analyses_user_date ON competitor_analyses(user_id, analyzed_at DESC);',
      ],
    },
  ];

  for (const table of tables) {
    try {
      console.log(`[init] Creating table: ${table.name}`);
      const createResult = await query(table.sql, []);
      console.log(`[init] ✅ Table '${table.name}' ready`);
      
      // Create indexes
      if (table.indexes) {
        for (const indexSql of table.indexes) {
          try {
            await query(indexSql, []);
          } catch (idxErr) {
            console.log(`[init] ⚠️ Index for '${table.name}' creation skipped (may already exist): ${idxErr.message}`);
          }
        }
      }
    } catch (tableErr) {
      console.error(`[init] ❌ Failed to create table '${table.name}': ${tableErr.message}`);
      // Don't crash — continue creating other tables
    }
  }

  // Check for stripe_subscription_id column (upgrade migration)
  try {
    const checkResult = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'stripe_subscription_id'
    `, []);
    if (checkResult.rows.length === 0) {
      console.log('[init] Running migration: add Stripe columns to users table');
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)`, []);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255)`, []);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_status VARCHAR(50) DEFAULT 'incomplete'`, []);
      console.log('[init] ✅ Stripe columns migration complete');
    }
  } catch (migrateErr) {
    console.error(`[init] ⚠️ Migration check skipped: ${migrateErr.message}`);
  }

  // === Elasticsearch 索引初始化（模块14·高级） ===
  try {
    console.log('[init] Checking Elasticsearch configuration...');
    if (process.env.ES_NODE) {
      console.log('[init] ES_NODE configured, initializing ES indexes...');
      // Defer ES initialization to avoid blocking the server start
      import('../lib/es-indexer.js').then(async ({ rebuildAllIndexes }) => {
        try {
          await rebuildAllIndexes();
        } catch (esErr) {
          console.error(`[init] ⚠️ ES index initialization: ${esErr.message}`);
          console.error('[init] ES features will be unavailable, PostgreSQL fallback active.');
        }
      }).catch(esImportErr => {
        console.error(`[init] ⚠️ Failed to import ES module: ${esImportErr.message}`);
      });
      console.log('[init] ✅ ES initialization triggered (async)');
    } else {
      console.log('[init] ℹ️ ES_NODE not set — Elasticsearch features disabled');
    }
  } catch (esInitErr) {
    // Don't crash — ES is optional
    console.error(`[init] ⚠️ ES init check failed: ${esInitErr.message}`);
  }

  console.log('[init] ✅ Database initialization complete');
}

initDatabase().catch((err) => {
  console.error('[init] ❌ Fatal error:', err.message);
  process.exit(0); // Graceful exit — don't crash server
});
