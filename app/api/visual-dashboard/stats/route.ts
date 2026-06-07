/**
 * /api/visual-dashboard/stats — 数据可视化仪表盘 API
 * 模块12 验证：多维度统计 + 图表数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { appCache, SEARCH_CACHE_TTL } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'overview';

  const cacheKey = `visual-dashboard:${type}`;
  const cached: any = appCache.get(cacheKey);
  if (cached) {
    return NextResponse.json({ data: cached, cached: true });
  }

  try {
    let data;

    switch (type) {

      // ─── 概览统计（总览卡片） ───
      case 'overview': {
        const [scrapedResult, analysisResult] = await Promise.all([
          query(`
            SELECT
              COUNT(*)::int as total_pages,
              COUNT(DISTINCT domain)::int as total_domains,
              ROUND(AVG(fetch_time_ms))::int as avg_fetch_time,
              ROUND(AVG(word_count))::int as avg_word_count,
              MAX(crawled_at) as last_crawl,
              MIN(crawled_at) as first_crawl,
              SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END)::int as ok_pages,
              SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)::int as error_pages,
              SUM(CASE WHEN has_og_tags = true THEN 1 ELSE 0 END)::int as pages_with_og,
              SUM(CASE WHEN has_sitemap = true THEN 1 ELSE 0 END)::int as pages_with_sitemap
            FROM scraped_pages
          `),
          query(`
            SELECT
              COUNT(*)::int as total_analyses,
              ROUND(AVG(score))::int as avg_score,
              MIN(score) as min_score,
              MAX(score) as max_score,
              COUNT(DISTINCT domain)::int as domains_analyzed,
              MAX(created_at) as last_analysis
            FROM seo_analyses
          `),
        ]);

        data = {
          scraped: scrapedResult.rows[0] || {},
          analyses: analysisResult.rows[0] || {},
        };
        break;
      }

      // ─── 评分等级分布（饼图数据） ───
      case 'grades': {
        const { rows } = await query(`
          SELECT
            grade,
            COUNT(*)::int as count,
            ROUND(AVG(score))::int as avg_score
          FROM seo_analyses
          GROUP BY grade
          ORDER BY grade
        `);
        data = rows;
        break;
      }

      // ─── 分数趋势（折线图数据—按天） ───
      case 'trend': {
        const days = parseInt(searchParams.get('days') || '30');
        const { rows } = await query(`
          SELECT
            DATE(created_at) as date,
            COUNT(*)::int as count,
            ROUND(AVG(score))::int as avg_score,
            MIN(score) as min_score,
            MAX(score) as max_score
          FROM seo_analyses
          WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY DATE(created_at)
          ORDER BY date
        `);
        data = rows;
        break;
      }

      // ─── 域名分析排名（柱状图数据） ───
      case 'domains': {
        const { rows } = await query(`
          SELECT
            domain,
            COUNT(*)::int as analysis_count,
            ROUND(AVG(score))::int as avg_score,
            MAX(score) as best_score,
            MIN(score) as worst_score,
            MAX(created_at) as last_analysis
          FROM seo_analyses
          GROUP BY domain
          ORDER BY analysis_count DESC
          LIMIT 20
        `);
        data = rows;
        break;
      }

      // ─── 状态码分布（饼图数据） ───
      case 'status_codes': {
        const { rows } = await query(`
          SELECT
            CASE
              WHEN status_code >= 200 AND status_code < 300 THEN '2xx 正常'
              WHEN status_code >= 300 AND status_code < 400 THEN '3xx 跳转'
              WHEN status_code >= 400 AND status_code < 500 THEN '4xx 客户端错误'
              WHEN status_code >= 500 THEN '5xx 服务端错误'
              ELSE '其他'
            END as category,
            COUNT(*)::int as count
          FROM scraped_pages
          GROUP BY category
          ORDER BY count DESC
        `);
        data = rows;
        break;
      }

      // ─── 综合表格数据（可导出CSV） ───
      case 'table': {
        const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
        const offset = parseInt(searchParams.get('offset') || '0');

        const { rows } = await query(`
          SELECT
            a.id, a.url, a.domain, a.score, a.grade,
            a.created_at, a.user_id,
            (a.report->'summary'->>'critical')::int as critical_issues,
            (a.report->'summary'->>'warnings')::int as warnings,
            (a.report->'summary'->>'suggestions')::int as suggestions
          FROM seo_analyses a
          ORDER BY a.created_at DESC
          LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await query('SELECT COUNT(*)::int as total FROM seo_analyses');

        data = {
          rows,
          total: countResult.rows[0].total,
          limit,
          offset,
        };
        break;
      }

      default:
        return NextResponse.json({ error: '未知统计类型' }, { status: 400 });
    }

    appCache.set(cacheKey, data, { ttl: SEARCH_CACHE_TTL * 2 });

    return NextResponse.json({ data, cached: false });
  } catch (error: any) {
    console.error('[visual-dashboard] Error:', error.message);
    return NextResponse.json(
      { error: '获取统计数据失败', detail: error.message },
      { status: 500 }
    );
  }
}
