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
        'CREATE INDEX IF NOT EXISTS idx_name_history_user_created ON name_history(user_id, created_at DESC);',
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
        // Module 10: Composite index for user+time queries
        'CREATE INDEX IF NOT EXISTS idx_articles_user_created ON articles(user_id, created_at DESC);',
        // Module 10: Full-text search vector index (title + topic + content)
        'CREATE INDEX IF NOT EXISTS idx_articles_search ON articles USING gin(to_tsvector(\'english\', coalesce(title, \'\') || \' \' || coalesce(topic, \'\') || \' \' || coalesce(content, \'\')));',
      ],
    },
    {
      name: 'scraped_pages',
      sql: `
        CREATE TABLE IF NOT EXISTS scraped_pages (
          id SERIAL PRIMARY KEY,
          url VARCHAR(2048) NOT NULL,
          domain VARCHAR(255) NOT NULL,
          title VARCHAR(500) DEFAULT '',
          meta_description TEXT DEFAULT '',
          meta_keywords TEXT DEFAULT '',
          og_title VARCHAR(500) DEFAULT '',
          og_description TEXT DEFAULT '',
          og_image VARCHAR(2048) DEFAULT '',
          h1_count INTEGER DEFAULT 0,
          h2_count INTEGER DEFAULT 0,
          h3_count INTEGER DEFAULT 0,
          internal_links_count INTEGER DEFAULT 0,
          external_links_count INTEGER DEFAULT 0,
          image_count INTEGER DEFAULT 0,
          images_with_alt INTEGER DEFAULT 0,
          word_count INTEGER DEFAULT 0,
          status_code INTEGER DEFAULT 200,
          fetch_time_ms INTEGER DEFAULT 0,
          has_favicon BOOLEAN DEFAULT FALSE,
          has_sitemap BOOLEAN DEFAULT FALSE,
          has_og_tags BOOLEAN DEFAULT FALSE,
          crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(url)
        );
      `,
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_scraped_domain ON scraped_pages(domain);',
        'CREATE INDEX IF NOT EXISTS idx_scraped_crawled_at ON scraped_pages(crawled_at DESC);',
        'CREATE INDEX IF NOT EXISTS idx_scraped_url ON scraped_pages(url);',
        'CREATE INDEX IF NOT EXISTS idx_scraped_domain_crawled ON scraped_pages(domain, crawled_at DESC);',
      ],
    },
    {
      name: 'seo_analyses',
      sql: `
        CREATE TABLE IF NOT EXISTS seo_analyses (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          url VARCHAR(2048) NOT NULL,
          domain VARCHAR(255) NOT NULL,
          score INTEGER NOT NULL DEFAULT 0,
          grade VARCHAR(1) NOT NULL DEFAULT 'F',
          report JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_seo_user_id ON seo_analyses(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_seo_created_at ON seo_analyses(created_at DESC);',
        'CREATE INDEX IF NOT EXISTS idx_seo_user_created ON seo_analyses(user_id, created_at DESC);',
        'CREATE INDEX IF NOT EXISTS idx_seo_domain ON seo_analyses(domain);',
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

  // Module 14: Search tables
  try {
    // Enable pg_trgm for fuzzy search
    try {
      await query('CREATE EXTENSION IF NOT EXISTS pg_trgm', []);
    } catch { /* not available */ }

    await query(`
      CREATE TABLE IF NOT EXISTS search_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        keyword VARCHAR(500) NOT NULL,
        result_count INTEGER DEFAULT 0,
        source VARCHAR(50) DEFAULT 'site',
        searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[init] Table "search_history" ready');

    const searchIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, searched_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_search_history_keyword ON search_history(keyword)',
      'CREATE INDEX IF NOT EXISTS idx_search_history_searched ON search_history(searched_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_search_history_keyword_trgm ON search_history USING gin (keyword gin_trgm_ops)',
    ];
    for (const idx of searchIndexes) {
      try { await query(idx, []); } catch {}
    }
    console.log('[init] search_history indexes ready');

    // Module 14 Intermediate: Synonym table
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS search_synonyms (
          id SERIAL PRIMARY KEY,
          word VARCHAR(255) NOT NULL UNIQUE,
          synonyms TEXT NOT NULL DEFAULT '[]',
          enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[init] Table "search_synonyms" ready');

      // Seed default synonyms if empty
      const count = await query('SELECT COUNT(*) as cnt FROM search_synonyms', []);
      if (parseInt(count.rows[0].cnt) === 0) {
        const defaultSynonyms = [
          { word: 'seo', synonyms: ['搜索引擎优化', '搜索引擎', 'search engine optimization', '排名', '排名优化'] },
          { word: '爬虫', synonyms: ['爬取', '抓取', '数据采集', 'crawler', 'spider', '网络爬虫'] },
          { word: '网站', synonyms: ['站点', '网页', '页面', 'web', 'website', 'site'] },
          { word: '诊断', synonyms: ['检测', '检查', '分析', 'audit', 'analyze', 'diag'] },
          { word: '速度', synonyms: ['性能', '加载速度', 'performance', 'speed', '加载时间'] },
          { word: '缓存', synonyms: ['cache', '缓存技术', '页面缓存'] },
          { word: '图片', synonyms: ['image', '图片优化', '图片压缩', 'img', '图像'] },
          { word: '文章', synonyms: ['博客', 'blog', '文章内容', '帖子', 'post'] },
          { word: '关键词', synonyms: ['关键字', 'keyword', '搜索词', '搜索关键词'] },
        ];
        for (const syn of defaultSynonyms) {
          try {
            await query(
              `INSERT INTO search_synonyms (word, synonyms) VALUES ($1, $2)`,
              [syn.word, JSON.stringify(syn.synonyms)]
            );
          } catch { /* skip duplicates */ }
        }
        console.log('[init] Default synonyms seeded:', defaultSynonyms.length);
      }
    } catch (err) {
      console.error('[init] Failed to create synonym table:', err.message);
    }

    // Module 14 Intermediate: Search index metadata
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS search_index_meta (
          id SERIAL PRIMARY KEY,
          entity_type VARCHAR(50) NOT NULL,
          entity_count INTEGER DEFAULT 0,
          index_size_bytes BIGINT DEFAULT 0,
          last_indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          index_version INTEGER DEFAULT 1,
          UNIQUE(entity_type)
        );
      `);
      console.log('[init] Table "search_index_meta" ready');

      // Initialize metadata for each entity
      const entities = ['articles', 'scraped_pages', 'seo_analyses'];
      for (const entity of entities) {
        try {
          const countResult = await query(`SELECT COUNT(*) as cnt FROM ${entity}`, []);
          const count = parseInt(countResult.rows[0]?.cnt || '0');
          await query(`
            INSERT INTO search_index_meta (entity_type, entity_count, index_version, last_indexed_at)
            VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
            ON CONFLICT (entity_type)
            DO UPDATE SET entity_count = EXCLUDED.entity_count, last_indexed_at = CURRENT_TIMESTAMP
          `, [entity, count]);
        } catch { /* skip */ }
      }
      console.log('[init] search_index_meta initialized');
    } catch (err) {
      console.error('[init] Failed to create index meta table:', err.message);
    }
  } catch (err) {
    console.error('[init] Failed to create search tables:', err.message);
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
