/**
 * models/ArticleQuery.js — 模块10：数据能力进阶
 *
 * Data Mapper 模式 — 文章查询层
 * 功能：
 * - 全文搜索（带权重排序）
 * - 游标分页
 * - 复合索引感知查询
 * - 基础统计
 */

import { query } from '../lib/db.js';

const DEFAULT_LIMIT = 20;

export class ArticleQuery {
  /**
   * 全文搜索文章
   * 使用 PostgreSQL tsvector 全文搜索，标题A权重 > 主题B权重 > 正文C权重
   */
  static async search(keyword, { limit = DEFAULT_LIMIT, cursor, userId, articleType } = {}) {
    if (!keyword || keyword.trim().length === 0) {
      return this.list({ limit, cursor, userId, articleType });
    }

    const cleanKeyword = keyword.trim();

    // Try full-text search first
    try {
      const searchQuery = `
        SELECT id, user_id, topic, article_type, title, 
               substring(content, 1, 200) as content_preview,
               word_count, created_at,
               ts_rank(
                 to_tsvector('english', coalesce(title, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(content, '')),
                 plainto_tsquery('english', $1)
               ) AS rank
        FROM articles
        WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(content, ''))
              @@ plainto_tsquery('english', $1)
        ${userId ? 'AND user_id = $2' : ''}
        ${articleType ? `AND article_type = $${userId ? '3' : '2'}` : ''}
        ORDER BY rank DESC, created_at DESC
        LIMIT $${userId && articleType ? '4' : userId || articleType ? '3' : '2'};
      `;

      const params = [cleanKeyword];
      if (userId) params.push(userId);
      if (articleType) params.push(articleType);
      params.push(limit + 1);

      const result = await query(searchQuery, params);
      return this._processCursorResult(result.rows, limit);
    } catch (err) {
      // Fallback to ILIKE search if full-text fails
      console.log('[ArticleQuery] Full-text search failed, falling back to ILIKE:', err.message);
      return this._fallbackSearch(cleanKeyword, { limit, userId, articleType });
    }
  }

  /**
   * ILIKE 回退搜索（全文搜索不可用时）
   */
  static async _fallbackSearch(keyword, { limit, userId, articleType } = {}) {
    const conditions = ['(topic ILIKE $1 OR title ILIKE $1 OR content ILIKE $1)'];
    const params = [`%${keyword}%`];
    let paramIndex = 2;

    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }
    if (articleType) {
      conditions.push(`article_type = $${paramIndex++}`);
      params.push(articleType);
    }

    params.push(limit + 1);

    const sql = `
      SELECT id, user_id, topic, article_type, title,
             substring(content, 1, 200) as content_preview,
             word_count, created_at
      FROM articles
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex};
    `;

    const result = await query(sql, params);
    return this._processCursorResult(result.rows, limit);
  }

  /**
   * 文章列表（游标分页）
   */
  static async list({ limit = DEFAULT_LIMIT, cursor, userId, articleType } = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (cursor) {
      conditions.push('(created_at < $1 OR (created_at = $1 AND id < $2))');
      params.push(cursor.createdAt, cursor.id);
      paramIndex = 3;
    }

    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }
    if (articleType) {
      conditions.push(`article_type = $${paramIndex++}`);
      params.push(articleType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit + 1);

    const sql = `
      SELECT id, user_id, topic, article_type, title,
             substring(content, 1, 120) as content_preview,
             word_count, created_at
      FROM articles
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT $${paramIndex};
    `;

    const result = await query(sql, params);
    return this._processCursorResult(result.rows, limit);
  }

  /**
   * 按用户获取（传统偏移分页，适合小数据量）
   */
  static async findByUser(userId, { page = 1, limit = DEFAULT_LIMIT } = {}) {
    const offset = (page - 1) * limit;
    const [dataResult, countResult] = await Promise.all([
      query(
        'SELECT * FROM articles WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset]
      ),
      query('SELECT COUNT(*) FROM articles WHERE user_id = $1', [userId]),
    ]);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    };
  }

  /**
   * 获取文章统计
   */
  static async getStats(userId) {
    const result = await query(
      `SELECT 
        COUNT(*) as total_articles,
        SUM(word_count) as total_words,
        AVG(word_count)::int as avg_words,
        MAX(created_at) as latest_article,
        COUNT(DISTINCT article_type) as type_count
      FROM articles
      WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0];
  }

  /**
   * 清理旧文章（保留最近N篇）
   */
  static async cleanup(userId, keepCount = 500) {
    await query(
      `DELETE FROM articles 
       WHERE user_id = $1 AND id NOT IN (
         SELECT id FROM articles WHERE user_id = $1 
         ORDER BY created_at DESC LIMIT $2
       )`,
      [userId, keepCount]
    );
  }

  /**
   * 处理游标分页结果
   * 多取一条判断是否有下一页，返回 nextCursor
   */
  static _processCursorResult(rows, limit) {
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      nextCursor = {
        createdAt: last.created_at,
        id: last.id,
      };
    }

    return { data, nextCursor, hasMore };
  }
}

export default ArticleQuery;
