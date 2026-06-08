// models/AdPlacement.js — 广告位数据库模型
import { query } from '../lib/db.js';

export async function createTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS ad_placements (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      position VARCHAR(50) NOT NULL,
      source VARCHAR(100) DEFAULT 'default',
      ad_type VARCHAR(50) DEFAULT 'custom',
      ad_code TEXT,
      ad_script TEXT,
      is_active BOOLEAN DEFAULT true,
      priority INT DEFAULT 0,
      max_impressions_per_session INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 尝试添加新列（兼容升级）
  const columns = [
    'ad_type VARCHAR(50) DEFAULT \'custom\'',
    'ad_script TEXT',
    'priority INT DEFAULT 0',
    'max_impressions_per_session INT DEFAULT 1',
  ];
  for (const col of columns) {
    try {
      await query(`ALTER TABLE ad_placements ADD COLUMN IF NOT EXISTS ${col}`);
    } catch (_) {}
  }
}

// ===== Analytics tables =====

export async function createAnalyticsTables() {
  // 广告曝光/点击追踪
  await query(`
    CREATE TABLE IF NOT EXISTS ad_events (
      id SERIAL PRIMARY KEY,
      ad_id INTEGER REFERENCES ad_placements(id),
      event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('impression', 'click')),
      page_url VARCHAR(500) NOT NULL,
      referrer VARCHAR(500),
      user_agent VARCHAR(300),
      session_id VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 页面浏览分析 (替换内存存储)
  await query(`
    CREATE TABLE IF NOT EXISTS page_analytics (
      id SERIAL PRIMARY KEY,
      page_url VARCHAR(500) NOT NULL,
      referrer VARCHAR(500) DEFAULT '(direct)',
      user_agent VARCHAR(300),
      screen_size VARCHAR(30),
      session_id VARCHAR(100),
      country VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 每日汇总
  await query(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      page_url VARCHAR(500) NOT NULL,
      pageviews INT DEFAULT 0,
      unique_sessions INT DEFAULT 0,
      ad_impressions INT DEFAULT 0,
      ad_clicks INT DEFAULT 0,
      UNIQUE(date, page_url)
    );
  `);

  // 营收记录
  await query(`
    CREATE TABLE IF NOT EXISTS revenue_log (
      id SERIAL PRIMARY KEY,
      source VARCHAR(100) NOT NULL,
      amount NUMERIC(10, 4) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'USD',
      impressions INT DEFAULT 0,
      clicks INT DEFAULT 0,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// ===== CRUD Operations =====

export async function getAllAdPlacements() {
  const result = await query(
    'SELECT * FROM ad_placements ORDER BY priority DESC, id ASC'
  );
  return result.rows;
}

export async function getActiveAdPlacements() {
  const result = await query(
    'SELECT * FROM ad_placements WHERE is_active = true ORDER BY priority DESC, id ASC'
  );
  return result.rows;
}

export async function getAdPlacementById(id) {
  const result = await query('SELECT * FROM ad_placements WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getAdPlacementsByPosition(position) {
  const result = await query(
    'SELECT * FROM ad_placements WHERE is_active = true AND position = $1 ORDER BY priority DESC',
    [position]
  );
  return result.rows;
}

export async function createAdPlacement(data) {
  const result = await query(
    `INSERT INTO ad_placements 
     (name, position, source, ad_type, ad_code, ad_script, is_active, priority, max_impressions_per_session)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.name,
      data.position,
      data.source || 'default',
      data.ad_type || 'custom',
      data.ad_code || '',
      data.ad_script || '',
      data.is_active !== false,
      data.priority || 0,
      data.max_impressions_per_session || 1,
    ]
  );
  return result.rows[0];
}

export async function updateAdPlacement(id, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      // Convert camelCase to snake_case for SQL
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      fields.push(`${snakeKey} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return;

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await query(
    `UPDATE ad_placements SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteAdPlacement(id) {
  await query('DELETE FROM ad_placements WHERE id = $1', [id]);
}

// ===== Tracking Operations =====

export async function trackAdEvent(data) {
  try {
    await query(
      `INSERT INTO ad_events (ad_id, event_type, page_url, referrer, user_agent, session_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.adId,
        data.eventType,
        data.pageUrl,
        data.referrer || '',
        data.userAgent || '',
        data.sessionId || '',
      ]
    );
  } catch (err) {
    console.error('[ad_tracking] error:', err.message);
  }
}

export async function trackPageView(data) {
  try {
    await query(
      `INSERT INTO page_analytics (page_url, referrer, user_agent, screen_size, session_id, country)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.pageUrl,
        data.referrer || '(direct)',
        data.userAgent || '',
        data.screenSize || '',
        data.sessionId || '',
        data.country || '',
      ]
    );
  } catch (err) {
    console.error('[page_tracking] error:', err.message);
  }
}

// ===== Stats Queries =====

export async function getAdStats(days) {
  const result = await query(
    `SELECT 
       COALESCE(a.name, 'unknown') as ad_name,
       a.position,
       COUNT(CASE WHEN e.event_type = 'impression' THEN 1 END) as impressions,
       COUNT(CASE WHEN e.event_type = 'click' THEN 1 END) as clicks,
       CASE 
         WHEN COUNT(CASE WHEN e.event_type = 'impression' THEN 1 END) > 0 
         THEN ROUND(
           COUNT(CASE WHEN e.event_type = 'click' THEN 1 END)::numeric / 
           COUNT(CASE WHEN e.event_type = 'impression' THEN 1 END) * 100, 2
         )
         ELSE 0 
       END as ctr
     FROM ad_events e
     LEFT JOIN ad_placements a ON e.ad_id = a.id
     WHERE e.created_at >= CURRENT_DATE - $1::interval
     GROUP BY a.id, a.name, a.position
     ORDER BY impressions DESC`,
    [`${days} days`]
  );
  return result.rows;
}

export async function getPageAnalytics(days, limit) {
  const result = await query(
    `SELECT 
       page_url,
       COUNT(*) as pageviews,
       COUNT(DISTINCT session_id) as unique_sessions,
       MAX(created_at) as last_visit
     FROM page_analytics
     WHERE created_at >= CURRENT_DATE - $1::interval
     GROUP BY page_url
     ORDER BY pageviews DESC
     LIMIT $2`,
    [`${days} days`, limit || 20]
  );
  return result.rows;
}

export async function getRevenueStats(days) {
  const result = await query(
    `SELECT 
       source,
       COALESCE(SUM(amount), 0) as total_revenue,
       COALESCE(SUM(impressions), 0) as total_impressions,
       COALESCE(SUM(clicks), 0) as total_clicks,
       MAX(date) as last_event
     FROM revenue_log
     WHERE date >= CURRENT_DATE - $1::interval
     GROUP BY source
     ORDER BY total_revenue DESC`,
    [`${days} days`]
  );
  return result.rows;
}

export async function getDailySummary(days) {
  const result = await query(
    `SELECT 
       date,
       SUM(pageviews) as total_pageviews,
       SUM(unique_sessions) as total_sessions,
       SUM(ad_impressions) as total_ad_impressions,
       SUM(ad_clicks) as total_ad_clicks,
       CASE WHEN SUM(ad_impressions) > 0 
         THEN ROUND(SUM(ad_clicks)::numeric / SUM(ad_impressions) * 100, 2) 
         ELSE 0 
       END as daily_ctr
     FROM daily_stats
     WHERE date >= CURRENT_DATE - $1::interval
     GROUP BY date
     ORDER BY date DESC`,
    [`${days} days`]
  );
  return result.rows;
}

// ===== Initialization =====

export async function initializeAdSystem() {
  await createTable();
  await createAnalyticsTables();

  // 创建默认广告位（如果不存在）
  const existing = await getAllAdPlacements();
  if (existing.length === 0) {
    const defaultAds = [
      {
        name: 'Bottom Global Ad',
        position: 'bottom',
        source: 'global',
        ad_type: 'custom',
        ad_code: '',
        ad_script: '',
        priority: 0,
      },
      {
        name: 'Bottom Default Ad',
        position: 'bottom',
        source: 'default',
        ad_type: 'custom',
        ad_code: '',
        ad_script: '',
        priority: 1,
      },
      {
        name: 'Sidebar Ad Placement',
        position: 'sidebar',
        source: 'default',
        ad_type: 'custom',
        ad_code: '',
        ad_script: '',
        priority: 1,
      },
      {
        name: 'Inline SEO Result Ad',
        position: 'inline',
        source: 'seo',
        ad_type: 'custom',
        ad_code: '',
        ad_script: '',
        priority: 1,
      },
      {
        name: 'Header Banner',
        position: 'header',
        source: 'global',
        ad_type: 'custom',
        ad_code: '',
        ad_script: '',
        priority: 1,
      },
    ];

    for (const ad of defaultAds) {
      await createAdPlacement(ad);
    }
    console.log('[ad] Default ad placements created');
  }
}
