/**
 * models/ContentFactory.js — SEO内容工厂数据模型
 *
 * 管理内容规划 → 生成 → 排期 → 发布的全生命周期
 * 表：content_plans（内容选题计划）
 */

import { query } from '../lib/db.js';

export async function createTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS content_plans (
      id SERIAL PRIMARY KEY,
      keyword VARCHAR(200) NOT NULL,
      title_suggestion VARCHAR(500) DEFAULT '',
      description TEXT DEFAULT '',
      style VARCHAR(20) DEFAULT 'tutorial',
      category VARCHAR(100) DEFAULT '未分类',
      status VARCHAR(20) DEFAULT 'planned',
      blog_post_id INTEGER REFERENCES blog_posts(id) ON DELETE SET NULL,
      scheduled_for TIMESTAMP,
      priority INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    await query('CREATE INDEX IF NOT EXISTS idx_content_plans_status ON content_plans(status);');
    await query('CREATE INDEX IF NOT EXISTS idx_content_plans_keyword ON content_plans(keyword);');
    await query('CREATE INDEX IF NOT EXISTS idx_content_plans_scheduled ON content_plans(scheduled_for) WHERE scheduled_for IS NOT NULL;');
  } catch (_) {}
}

// ============ CRUD ============

export async function createPlan({ keyword, titleSuggestion, description, style, category, priority = 0 }) {
  const sql = `
    INSERT INTO content_plans (keyword, title_suggestion, description, style, category, priority)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const result = await query(sql, [
    keyword.substring(0, 200),
    (titleSuggestion || '').substring(0, 500),
    description || '',
    style || 'tutorial',
    (category || '未分类').substring(0, 100),
    priority,
  ]);
  return result.rows[0];
}

export async function createPlansBatch(plans) {
  if (!plans.length) return [];
  const values = plans.map((_, i) =>
    `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`
  ).join(', ');
  const flatParams = plans.flatMap(p => [
    (p.keyword || '').substring(0, 200),
    (p.titleSuggestion || '').substring(0, 500),
    p.description || '',
    p.style || 'tutorial',
    (p.category || '未分类').substring(0, 100),
    p.priority || 0,
  ]);
  const sql = `
    INSERT INTO content_plans (keyword, title_suggestion, description, style, category, priority)
    VALUES ${values}
    RETURNING *;
  `;
  const result = await query(sql, flatParams);
  return result.rows;
}

/** @param {{ status?: string, limit?: number, offset?: number, category?: string }} opts */
export async function getPlans({ status, limit = 50, offset = 0, category } = {}) {
  let conditions = [];
  let params = [];
  let idx = 1;

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }
  if (category) {
    conditions.push(`category = $${idx++}`);
    params.push(category);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT cp.*, bp.title as post_title, bp.status as post_status, bp.view_count as post_views,
           bp.published_at as post_published_at, bp.slug as post_slug
    FROM content_plans cp
    LEFT JOIN blog_posts bp ON cp.blog_post_id = bp.id
    ${where}
    ORDER BY cp.priority DESC, cp.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++};
  `;
  params.push(limit, offset);
  const result = await query(sql, params);
  return result.rows;
}

export async function getStats() {
  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'planned') AS planned_count,
      COUNT(*) FILTER (WHERE status = 'generating') AS generating_count,
      COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
      COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled_count,
      COUNT(*) FILTER (WHERE status = 'published') AS published_count,
      COUNT(*) AS total_count
    FROM content_plans;
  `;
  const result = await query(sql);
  return result.rows[0];
}

export async function getPlanById(id) {
  const sql = `
    SELECT cp.*, bp.title as post_title, bp.status as post_status,
           bp.view_count as post_views, bp.published_at as post_published_at,
           bp.slug as post_slug
    FROM content_plans cp
    LEFT JOIN blog_posts bp ON cp.blog_post_id = bp.id
    WHERE cp.id = $1;
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

export async function updatePlan(id, updates) {
  const fields = [];
  const params = [];
  let idx = 1;

  const fieldMap = {
    titleSuggestion: 'title_suggestion',
    description: 'description',
    style: 'style',
    category: 'category',
    status: 'status',
    blogPostId: 'blog_post_id',
    scheduledFor: 'scheduled_for',
    priority: 'priority',
    keyword: 'keyword',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      fields.push(`${col} = $${idx++}`);
      params.push(updates[key]);
    }
  }

  if (!fields.length) return null;

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(id);

  const sql = `UPDATE content_plans SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *;`;
  const result = await query(sql, params);
  return result.rows[0] || null;
}

export async function deletePlan(id) {
  const result = await query('DELETE FROM content_plans WHERE id = $1 RETURNING id;', [id]);
  return result.rowCount > 0;
}

// ============ Topic Discovery ============

/**
 * 从关键词研究数据中发现内容机会
 * 查找已保存的关键词中，哪些还没有对应的content_plan
 */
export async function discoverTopicsFromKeywords(userId = 1) {
  const sql = `
    SELECT DISTINCT ks.keyword, ks.search_volume, ks.competition, ks.notes
    FROM keyword_saved ks
    WHERE ks.user_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM content_plans cp
        WHERE cp.keyword ILIKE '%' || ks.keyword || '%'
           OR ks.keyword ILIKE '%' || cp.keyword || '%'
      )
    ORDER BY ks.search_volume DESC NULLS LAST
    LIMIT 100;
  `;
  const result = await query(sql, [userId]);
  return result.rows;
}

/**
 * 按分类获取待生成的内容统计
 */
export async function getCategoryBreakdown() {
  const sql = `
    SELECT category,
      COUNT(*) FILTER (WHERE status = 'planned') AS planned,
      COUNT(*) FILTER (WHERE status = 'draft') AS draft,
      COUNT(*) FILTER (WHERE status = 'published') AS published,
      COUNT(*) AS total
    FROM content_plans
    GROUP BY category
    ORDER BY total DESC;
  `;
  const result = await query(sql);
  return result.rows;
}

/**
 * 获取下N个待生成的内容计划（按优先级 + 创建时间排序）
 */
export async function getNextPlansToGenerate(limit = 5) {
  const sql = `
    SELECT *
    FROM content_plans
    WHERE status = 'planned'
    ORDER BY priority DESC, created_at ASC
    LIMIT $1;
  `;
  const result = await query(sql, [limit]);
  return result.rows;
}
