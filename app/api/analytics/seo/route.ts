/**
 * /api/analytics/seo — SEO Analytics Dashboard API
 * 模块12 验证：数据聚合 + 服务端统计
 *
 * 返回：
 * - 总体统计
 * - 评分分布（区间计数）
 * - 按天趋势
 * - 问题类型TOP统计
 * - 域名对比
 * - 状态码分布
 */

import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '30'), 365);
    const domain = searchParams.get('domain') || '';
    const dateFrom = searchParams.get('from') || '';
    const dateTo = searchParams.get('to') || '';

    // Calculate date range
    let dateWhere = '';
    const dateParams: string[] = [];
    let paramIdx = 1;

    if (dateFrom) {
      dateWhere += ` AND crawled_at >= $${paramIdx}`;
      dateParams.push(dateFrom);
      paramIdx++;
    }
    if (dateTo) {
      dateWhere += ` AND crawled_at <= $${paramIdx}`;
      dateParams.push(dateTo + 'T23:59:59Z');
      paramIdx++;
    }
    if (!dateFrom && !dateTo) {
      dateWhere += ` AND crawled_at >= NOW() - INTERVAL '${days} days'`;
    }

    let domainWhere = '';
    const domainParams: string[] = [];
    if (domain) {
      domainWhere = ` AND domain = $${paramIdx}`;
      domainParams.push(domain);
      paramIdx++;
    }

    const commonWhere = dateWhere + domainWhere;
    const allParams = [...dateParams, ...domainParams];

    // 1. Global stats
    const globalStatsSql = `
      SELECT
        COUNT(*)::int as total_pages,
        COUNT(DISTINCT domain)::int as total_domains,
        COALESCE(AVG(fetch_time_ms)::int, 0) as avg_fetch_time,
        COALESCE(AVG(word_count)::int, 0) as avg_word_count,
        SUM(word_count)::bigint as total_words,
        COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300)::int as ok_pages,
        COUNT(*) FILTER (WHERE status_code >= 400)::int as error_pages,
        COUNT(*) FILTER (WHERE has_og_tags)::int as pages_with_og,
        COUNT(*) FILTER (WHERE has_sitemap)::int as pages_with_sitemap,
        MIN(crawled_at)::text as first_crawl,
        MAX(crawled_at)::text as last_crawl
      FROM scraped_pages
      WHERE 1=1 ${commonWhere};
    `;

    // 2. Score distribution (using proxy score based on available fields)
    const scoreDistributionSql = `
      WITH scored AS (
        SELECT
          id,
          CASE
            WHEN status_code >= 400 THEN 0
            ELSE (
              (CASE WHEN title != '' THEN 15 ELSE 0 END) +
              (CASE WHEN meta_description != '' AND meta_description IS NOT NULL THEN 15 ELSE 0 END) +
              (CASE WHEN has_og_tags THEN 15 ELSE 0 END) +
              (CASE WHEN h1_count > 0 THEN 15 ELSE 0 END) +
              (CASE WHEN images_with_alt > 0 THEN 10 ELSE 0 END) +
              (CASE WHEN image_count = 0 OR (images_with_alt::float / GREATEST(image_count, 1)) >= 0.5 THEN 10 ELSE 0 END) +
              (CASE WHEN has_sitemap THEN 10 ELSE 0 END) +
              (CASE WHEN word_count > 100 THEN 5 ELSE 0 END) +
              (CASE WHEN fetch_time_ms < 2000 THEN 5 ELSE 0 END)
            )::int as score
          FROM scraped_pages
          WHERE 1=1 ${commonWhere}
      )
      SELECT
        COUNT(*) FILTER (WHERE score >= 90)::int as a_count,
        COUNT(*) FILTER (WHERE score >= 75 AND score < 90)::int as b_count,
        COUNT(*) FILTER (WHERE score >= 60 AND score < 75)::int as c_count,
        COUNT(*) FILTER (WHERE score < 60)::int as d_count,
        COALESCE(AVG(score)::int, 0) as avg_score
      FROM scored;
    `;

    // 3. Daily trend (last 30 data points)
    const dailyTrendSql = `
      WITH daily AS (
        SELECT
          DATE(crawled_at) as date,
          COUNT(*)::int as total,
          COALESCE(AVG(
            CASE WHEN status_code >= 400 THEN 0
            ELSE (
              (CASE WHEN title != '' THEN 15 ELSE 0 END) +
              (CASE WHEN meta_description != '' AND meta_description IS NOT NULL THEN 15 ELSE 0 END) +
              (CASE WHEN has_og_tags THEN 15 ELSE 0 END) +
              (CASE WHEN h1_count > 0 THEN 15 ELSE 0 END)
            ) END
          )::int, 0) as avg_score,
          COUNT(*) FILTER (WHERE status_code >= 400)::int as errors
        FROM scraped_pages
        WHERE 1=1 ${commonWhere}
        GROUP BY DATE(crawled_at)
        ORDER BY date DESC
        LIMIT 30
      )
      SELECT * FROM daily ORDER BY date ASC;
    `;

    // 4. Issue type breakdown
    const issueTypesSql = `
      WITH issues AS (
        SELECT unnest(ARRAY[
          CASE WHEN (title = '' OR title IS NULL) THEN '缺少标题' ELSE NULL END,
          CASE WHEN (meta_description = '' OR meta_description IS NULL) THEN '缺少Meta描述' ELSE NULL END,
          CASE WHEN (h1_count = 0) THEN '缺少H1标签' ELSE NULL END,
          CASE WHEN (NOT has_og_tags) THEN '缺少OG标签' ELSE NULL END,
          CASE WHEN (image_count > 0 AND images_with_alt::float / GREATEST(image_count, 1) < 0.5) THEN '图片缺少Alt' ELSE NULL END,
          CASE WHEN (NOT has_sitemap) THEN '缺少Sitemap' ELSE NULL END,
          CASE WHEN (status_code >= 400) THEN 'HTTP错误' ELSE NULL END,
          CASE WHEN (fetch_time_ms >= 3000) THEN '加载过慢' ELSE NULL END
        ]) as issue_type
        FROM scraped_pages
        WHERE 1=1 ${commonWhere}
      )
      SELECT issue_type, COUNT(*)::int as count
      FROM issues
      WHERE issue_type IS NOT NULL
      GROUP BY issue_type
      ORDER BY count DESC;
    `;

    // 5. Domain comparison (top 10 by page count)
    const domainComparisonSql = `
      SELECT
        domain,
        COUNT(*)::int as page_count,
        COALESCE(AVG(fetch_time_ms)::int, 0) as avg_fetch_time,
        COALESCE(AVG(word_count)::int, 0) as avg_word_count,
        COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300)::int as ok_count,
        COUNT(*) FILTER (WHERE has_og_tags)::int as og_count,
        MAX(crawled_at)::text as last_crawled
      FROM scraped_pages
      WHERE 1=1 ${commonWhere}
      GROUP BY domain
      ORDER BY page_count DESC
      LIMIT 10;
    `;

    // 6. Status code distribution
    const statusCodeSql = `
      SELECT
        CASE
          WHEN status_code >= 200 AND status_code < 300 THEN '2xx 正常'
          WHEN status_code >= 300 AND status_code < 400 THEN '3xx 跳转'
          WHEN status_code >= 400 AND status_code < 500 THEN '4xx 客户端错误'
          WHEN status_code >= 500 THEN '5xx 服务端错误'
          ELSE '其他'
        END as status_group,
        COUNT(*)::int as count,
        ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) as percentage
      FROM scraped_pages
      WHERE 1=1 ${commonWhere}
      GROUP BY status_group
      ORDER BY count DESC;
    `;

    // 7. Domain scores (for radar chart)
    const domainScoresSql = `
      WITH domain_scored AS (
        SELECT
          domain,
          ROUND(AVG(CASE WHEN title != '' AND title IS NOT NULL THEN 100 ELSE 0 END), 1) as title_score,
          ROUND(AVG(CASE WHEN meta_description != '' AND meta_description IS NOT NULL THEN 100 ELSE 0 END), 1) as meta_score,
          ROUND(AVG(CASE WHEN h1_count > 0 THEN 100 ELSE 0 END), 1) as h1_score,
          ROUND(AVG(CASE WHEN has_og_tags THEN 100 ELSE 0 END), 1) as og_score,
          ROUND(AVG(CASE WHEN has_sitemap THEN 100 ELSE 0 END), 1) as sitemap_score,
          ROUND(AVG(CASE WHEN fetch_time_ms < 2000 THEN 100 WHEN fetch_time_ms < 3000 THEN 50 ELSE 0 END), 1) as perf_score,
          ROUND(AVG(CASE WHEN status_code < 400 THEN 100 ELSE 0 END), 1) as status_score
        FROM scraped_pages
        WHERE 1=1 ${commonWhere}
        GROUP BY domain
        ORDER BY COUNT(*) DESC
        LIMIT 5
      )
      SELECT * FROM domain_scored;
    `;

    // Run all queries in parallel
    const [
      globalStatsResult,
      scoreDistributionResult,
      dailyTrendResult,
      issueTypesResult,
      domainComparisonResult,
      statusCodeResult,
      domainScoresResult,
    ] = await Promise.all([
      query(globalStatsSql, allParams),
      query(scoreDistributionSql, allParams),
      query(dailyTrendSql, allParams),
      query(issueTypesSql, allParams),
      query(domainComparisonSql, allParams),
      query(statusCodeSql, allParams),
      query(domainScoresSql, allParams),
    ]);

    return NextResponse.json({
      globalStats: globalStatsResult.rows[0],
      scoreDistribution: scoreDistributionResult.rows[0],
      dailyTrend: dailyTrendResult.rows,
      issueTypes: issueTypesResult.rows,
      domainComparison: domainComparisonResult.rows,
      statusCodeDistribution: statusCodeResult.rows,
      domainScores: domainScoresResult.rows,
      filters: {
        days,
        domain: domain || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      },
    });
  } catch (error: any) {
    console.error('[analytics/seo] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
