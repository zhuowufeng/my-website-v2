/**
 * models/KeywordResearch.js
 * 关键词研究数据模型
 * 存储搜索历史和关键词库
 */

import { query } from '../lib/db.js';

export async function createTable() {
  // 关键词搜索历史表
  await query(`
    CREATE TABLE IF NOT EXISTS keyword_research_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      seed_keyword VARCHAR(200) NOT NULL,
      keyword_count INTEGER DEFAULT 0,
      results JSONB,
      is_favorite BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 关键词收藏/标记表（用户可以对关键词做标记）
  await query(`
    CREATE TABLE IF NOT EXISTS keyword_saved (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      keyword VARCHAR(200) NOT NULL,
      source VARCHAR(20) DEFAULT 'user',
      notes TEXT,
      search_volume INTEGER DEFAULT 0,
      competition VARCHAR(20) DEFAULT 'medium',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, keyword)
    );
  `);

  // 确保有索引
  try {
    await query(`CREATE INDEX IF NOT EXISTS idx_kw_history_user ON keyword_research_history(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_kw_history_keyword ON keyword_research_history(seed_keyword);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_kw_history_time ON keyword_research_history(created_at DESC);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_kw_saved_user ON keyword_saved(user_id);`);
  } catch (e) {
    // index may already exist
  }
}

// ============ Search History CRUD ============

export async function saveKeywordResearch(userId, seedKeyword, keywordCount, results) {
  const sql = `
    INSERT INTO keyword_research_history (user_id, seed_keyword, keyword_count, results)
    VALUES ($1, $2, $3, $4::jsonb)
    RETURNING id, created_at;
  `;
  const result = await query(sql, [userId, seedKeyword, keywordCount, JSON.stringify(results)]);
  return result.rows[0];
}

export async function getKeywordHistory(userId, limit = 20, offset = 0) {
  const sql = `
    SELECT id, seed_keyword, keyword_count, is_favorite, created_at
    FROM keyword_research_history
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const result = await query(sql, [userId, limit, offset]);
  return result.rows;
}

export async function getKeywordHistoryById(id, userId) {
  const sql = `SELECT * FROM keyword_research_history WHERE id = $1 AND user_id = $2;`;
  const result = await query(sql, [id, userId]);
  return result.rows[0];
}

export async function toggleFavorite(id, userId) {
  const sql = `
    UPDATE keyword_research_history
    SET is_favorite = NOT is_favorite
    WHERE id = $1 AND user_id = $2
    RETURNING is_favorite;
  `;
  const result = await query(sql, [id, userId]);
  return result.rows[0];
}

export async function deleteKeywordHistory(id, userId) {
  const sql = `DELETE FROM keyword_research_history WHERE id = $1 AND user_id = $2 RETURNING id;`;
  const result = await query(sql, [id, userId]);
  return result.rows[0];
}

// ============ Saved Keywords CRUD ============

export async function saveKeyword(userId, keyword, notes = '', searchVolume = 0, competition = 'medium') {
  const sql = `
    INSERT INTO keyword_saved (user_id, keyword, notes, search_volume, competition)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id, keyword) DO UPDATE SET
      notes = EXCLUDED.notes,
      search_volume = EXCLUDED.search_volume,
      competition = EXCLUDED.competition
    RETURNING id, created_at;
  `;
  const result = await query(sql, [userId, keyword, notes, searchVolume, competition]);
  return result.rows[0];
}

export async function getSavedKeywords(userId, limit = 50, offset = 0) {
  const sql = `
    SELECT id, keyword, notes, search_volume, competition, created_at
    FROM keyword_saved
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const result = await query(sql, [userId, limit, offset]);
  return result.rows;
}

export async function deleteSavedKeyword(id, userId) {
  const sql = `DELETE FROM keyword_saved WHERE id = $1 AND user_id = $2 RETURNING id;`;
  const result = await query(sql, [id, userId]);
  return result.rows[0];
}

// ============ Stats ============

export async function getKeywordStats(userId) {
  const sql = `
    SELECT
      COUNT(*) AS total_searches,
      SUM(keyword_count) AS total_keywords_found,
      COUNT(CASE WHEN is_favorite THEN 1 END) AS favorites
    FROM keyword_research_history
    WHERE user_id = $1;
  `;
  const result = await query(sql, [userId]);
  return result.rows[0] || { total_searches: 0, total_keywords_found: 0, favorites: 0 };
}

export async function getRecentTrendKeywords(limit = 10) {
  const sql = `
    SELECT seed_keyword, COUNT(*) AS search_count, AVG(keyword_count)::INT AS avg_keywords
    FROM keyword_research_history
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY seed_keyword
    ORDER BY search_count DESC
    LIMIT $1;
  `;
  const result = await query(sql, [limit]);
  return result.rows;
}

export async function getGlobalHotKeywords(limit = 20) {
  const sql = `
    SELECT keyword, COUNT(*) AS save_count
    FROM keyword_saved
    GROUP BY keyword
    ORDER BY save_count DESC
    LIMIT $1;
  `;
  const result = await query(sql, [limit]);
  return result.rows;
}
