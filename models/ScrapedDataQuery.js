/**
 * models/ScrapedDataQuery.js — 模块10：数据能力进阶
 *
 * Data Mapper 模式 — 爬取数据查询层
 * 功能：
 * - 按域名筛选
 * - 全文搜索（标题/描述）
 * - 多字段排序
 * - 游标分页
 * - 聚合统计
 */

import { query } from '../lib/db.js';

const DEFAULT_LIMIT = 20;
const CACHE_TTL = 30_000; // 30 seconds

export class ScrapedDataQuery {
  /**
   * 查询爬取数据列表（游标分页 + 筛选 + 排序）
   */
  static async find({
    limit = DEFAULT_LIMIT,
    cursor,
    domain,
    statusCode,
    hasOgTags,
    sort = 'crawled_at',
    order = 'desc',
    search,
  } = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Cursor pagination
    if (cursor) {
      const sortField = this._getSortField(sort);
      const op = order === 'desc' ? '<' : '>';
      conditions.push(`(${sortField} ${op} $1 OR (${sortField} = $1 AND id ${op} $2))`);
      params.push(cursor.sortValue, cursor.id);
      paramIndex = 3;
    }

    // Filters
    if (domain) {
      conditions.push(`domain ILIKE $${paramIndex++}`);
      params.push(`%${domain}%`);
    }
    if (statusCode !== undefined && statusCode !== null && statusCode !== '') {
      conditions.push(`status_code = $${paramIndex++}`);
      params.push(parseInt(statusCode));
    }
    if (hasOgTags === 'true') {
      conditions.push('has_og_tags = true');
    } else if (hasOgTags === 'false') {
      conditions.push('has_og_tags = false');
    }

    // Full-text search on title/description
    if (search && search.trim()) {
      conditions.push(`(title ILIKE $${paramIndex} OR meta_description ILIKE $${paramIndex})`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = `ORDER BY ${this._getSortField(sort)} ${order === 'asc' ? 'ASC' : 'DESC'}, id DESC`;

    params.push(limit + 1);

    // Build SELECT with page summary
    const sql = `
      SELECT id, url, domain, title, meta_description,
             og_title, og_image,
             h1_count, h2_count, h3_count,
             internal_links_count, external_links_count,
             image_count, images_with_alt,
             word_count, status_code, fetch_time_ms,
             has_favicon, has_sitemap, has_og_tags,
             crawled_at,
             CASE 
               WHEN status_code >= 200 AND status_code < 300 THEN 'ok'
               WHEN status_code >= 300 AND status_code < 400 THEN 'redirect'
               WHEN status_code >= 400 AND status_code < 500 THEN 'client_error'
               WHEN status_code >= 500 THEN 'server_error'
               ELSE 'unknown'
             END as status_category
      FROM scraped_pages
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex};
    `;

    const result = await query(sql, params);
    return this._processCursorResult(result.rows, limit, sort, order);
  }

  /**
   * 按域名分组统计
   */
  static async getDomainStats() {
    const result = await query(`
      SELECT 
        domain,
        COUNT(*) as page_count,
        AVG(fetch_time_ms)::int as avg_fetch_time,
        AVG(word_count)::int as avg_word_count,
        MAX(crawled_at) as last_crawled,
        COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as ok_count,
        COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
        COUNT(*) FILTER (WHERE has_og_tags) as with_og_tags,
        COUNT(*) FILTER (WHERE has_sitemap) as with_sitemap
      FROM scraped_pages
      GROUP BY domain
      ORDER BY page_count DESC
      LIMIT 50;
    `);

    return result.rows;
  }

  /**
   * 总体统计
   */
  static async getGlobalStats() {
    const result = await query(`
      SELECT 
        COUNT(*) as total_pages,
        COUNT(DISTINCT domain) as total_domains,
        AVG(fetch_time_ms)::int as avg_fetch_time,
        AVG(word_count)::int as avg_word_count,
        SUM(word_count) as total_words,
        COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as ok_pages,
        COUNT(*) FILTER (WHERE status_code >= 400) as error_pages,
        COUNT(*) FILTER (WHERE has_og_tags) as pages_with_og,
        COUNT(*) FILTER (WHERE has_sitemap) as pages_with_sitemap,
        MIN(crawled_at) as first_crawl,
        MAX(crawled_at) as last_crawl
      FROM scraped_pages;
    `);

    return result.rows[0];
  }

  /**
   * 按状态码统计
   */
  static async getStatusCodeDistribution() {
    const result = await query(`
      SELECT 
        status_code,
        COUNT(*) as count,
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
      FROM scraped_pages
      GROUP BY status_code
      ORDER BY count DESC;
    `);

    return result.rows;
  }

  /**
   * 获取单个页面详情
   */
  static async findById(id) {
    const result = await query('SELECT * FROM scraped_pages WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * 搜索域名（自动补全用）
   */
  static async searchDomains(keyword, limit = 10) {
    const result = await query(
      `SELECT DISTINCT domain, COUNT(*) as page_count
       FROM scraped_pages
       WHERE domain ILIKE $1
       GROUP BY domain
       ORDER BY page_count DESC
       LIMIT $2`,
      [`%${keyword}%`, limit]
    );
    return result.rows;
  }

  // ============ Internal Helpers ============

  static _getSortField(sort) {
    const fields = {
      crawled_at: 'crawled_at',
      word_count: 'word_count',
      fetch_time: 'fetch_time_ms',
      status_code: 'status_code',
      title: 'title',
      domain: 'domain',
    };
    return fields[sort] || 'crawled_at';
  }

  static _processCursorResult(rows, limit, sort, order) {
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      const sortField = this._getSortField(sort);
      nextCursor = {
        sortValue: last[sortField],
        id: last.id,
      };
    }

    return { data, nextCursor, hasMore };
  }
}

export default ScrapedDataQuery;
