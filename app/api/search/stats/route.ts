/**
 * /api/search/stats — 搜索统计API（中级功能）
 * 模块14：搜索能力
 *
 * GET /api/search/stats → 获取搜索统计数据
 * GET /api/search/stats?type=today → 今日搜索统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../lib/db';
import { getSearchIndexStatus } from '../../../../models/SearchQuery';
import { appCache } from '../../../../lib/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'overview';

  try {
    // Cache stats for 5 minutes to avoid heavy queries
    const cacheKey = `search:stats:${type}`;
    const cached = appCache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    let stats: Record<string, any> = {};

    switch (type) {
      case 'overview':
        stats = await getOverviewStats();
        break;
      case 'today':
        stats = await getTodayStats();
        break;
      case 'popular':
        stats = await getPopularSearches();
        break;
      case 'zero-results':
        stats = await getZeroResultAnalysis();
        break;
      case 'index':
        stats = { indexes: await getSearchIndexStatus() };
        break;
      default:
        stats = await getOverviewStats();
    }

    appCache.set(cacheKey, stats, { ttl: 300_000 }); // 5 min cache
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('[Search Stats API] Error:', error.message);
    return NextResponse.json(
      { error: '获取搜索统计数据失败' },
      { status: 500 }
    );
  }
}

/**
 * 总览统计
 */
async function getOverviewStats() {
  const [totalSearches, uniqueUsers, avgResults, topKeywords] = await Promise.all([
    query('SELECT COUNT(*) as total FROM search_history', []),
    query('SELECT COUNT(DISTINCT COALESCE(user_id::text, \'anonymous\')) as users FROM search_history', []),
    query('SELECT ROUND(AVG(result_count), 1) as avg FROM search_history', []),
    query(
      `SELECT keyword, COUNT(*) as search_count, 
              ROUND(AVG(result_count)) as avg_results,
              MAX(searched_at) as last_searched
       FROM search_history
       GROUP BY keyword
       ORDER BY search_count DESC
       LIMIT 10`,
      []
    ),
  ]);

  return {
    totalSearches: parseInt(totalSearches.rows[0]?.total || '0'),
    uniqueUsers: parseInt(uniqueUsers.rows[0]?.users || '0'),
    avgResultsPerSearch: parseFloat(avgResults.rows[0]?.avg || '0'),
    topKeywords: topKeywords.rows.map((r: any) => ({
      keyword: r.keyword,
      searchCount: parseInt(r.search_count),
      avgResults: parseInt(r.avg_results),
      lastSearched: r.last_searched,
    })),
  };
}

/**
 * 今日统计
 */
async function getTodayStats() {
  const [todaySearches, todayUsers, todayHighResult, todayZeroResult, hourly] = await Promise.all([
    query(
      `SELECT COUNT(*) as total FROM search_history
       WHERE searched_at >= CURRENT_DATE`,
      []
    ),
    query(
      `SELECT COUNT(DISTINCT COALESCE(user_id::text, 'anonymous')) as users
       FROM search_history WHERE searched_at >= CURRENT_DATE`,
      []
    ),
    query(
      `SELECT keyword, result_count FROM search_history
       WHERE searched_at >= CURRENT_DATE
       ORDER BY result_count DESC LIMIT 5`,
      []
    ),
    query(
      `SELECT COUNT(*) as total FROM search_history
       WHERE searched_at >= CURRENT_DATE AND result_count = 0`,
      []
    ),
    query(
      `SELECT EXTRACT(HOUR FROM searched_at) as hour, COUNT(*) as cnt
       FROM search_history
       WHERE searched_at >= CURRENT_DATE
       GROUP BY hour ORDER BY hour`,
      []
    ),
  ]);

  return {
    todaySearches: parseInt(todaySearches.rows[0]?.total || '0'),
    todayUsers: parseInt(todayUsers.rows[0]?.users || '0'),
    todayZeroResults: parseInt(todayZeroResult.rows[0]?.total || '0'),
    topResults: todayHighResult.rows.map((r: any) => ({
      keyword: r.keyword,
      resultCount: r.result_count,
    })),
    hourlyDistribution: hourly.rows.map((r: any) => ({
      hour: parseInt(r.hour),
      count: parseInt(r.cnt),
    })),
  };
}

/**
 * 热门搜索分析
 */
async function getPopularSearches() {
  const [weekly, monthly, trending] = await Promise.all([
    query(
      `SELECT keyword, COUNT(*) as cnt FROM search_history
       WHERE searched_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
       GROUP BY keyword ORDER BY cnt DESC LIMIT 20`,
      []
    ),
    query(
      `SELECT keyword, COUNT(*) as cnt FROM search_history
       WHERE searched_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
       GROUP BY keyword ORDER BY cnt DESC LIMIT 30`,
      []
    ),
    query(
      `WITH weekly AS (
         SELECT keyword, COUNT(*) as cnt
         FROM search_history
         WHERE searched_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
         GROUP BY keyword
       ),
       prev_weekly AS (
         SELECT keyword, COUNT(*) as cnt
         FROM search_history
         WHERE searched_at > CURRENT_TIMESTAMP - INTERVAL '14 days'
           AND searched_at <= CURRENT_TIMESTAMP - INTERVAL '7 days'
         GROUP BY keyword
       )
       SELECT
         COALESCE(w.keyword, p.keyword) as keyword,
         COALESCE(w.cnt, 0) as weekly_count,
         COALESCE(p.cnt, 0) as prev_count,
         CASE
           WHEN COALESCE(p.cnt, 0) = 0 THEN 100
           ELSE ROUND(((COALESCE(w.cnt, 0) - COALESCE(p.cnt, 0))::float / COALESCE(p.cnt, 0) * 100), 1)
         END as growth_pct
       FROM weekly w FULL OUTER JOIN prev_weekly p ON w.keyword = p.keyword
       ORDER BY weekly_count DESC
       LIMIT 15`,
      []
    ),
  ]);

  return {
    weekly: weekly.rows.map((r: any) => ({ keyword: r.keyword, count: parseInt(r.cnt) })),
    monthly: monthly.rows.map((r: any) => ({ keyword: r.keyword, count: parseInt(r.cnt) })),
    trending: trending.rows.map((r: any) => ({
      keyword: r.keyword,
      weeklyCount: parseInt(r.weekly_count),
      prevCount: parseInt(r.prev_count),
      growthPct: parseFloat(r.growth_pct),
    })),
  };
}

/**
 * 零结果搜索分析
 */
async function getZeroResultAnalysis() {
  const [all, bySource] = await Promise.all([
    query(
      `SELECT keyword, COUNT(*) as cnt, MAX(searched_at) as last_searched
       FROM search_history
       WHERE result_count = 0
       GROUP BY keyword
       ORDER BY cnt DESC LIMIT 20`,
      []
    ),
    query(
      `SELECT source, COUNT(*) as cnt FROM search_history
       WHERE result_count = 0
       GROUP BY source ORDER BY cnt DESC`,
      []
    ),
  ]);

  return {
    topMissingTerms: all.rows.map((r: any) => ({
      keyword: r.keyword,
      count: parseInt(r.cnt),
      lastSearched: r.last_searched,
    })),
    bySource: bySource.rows.map((r: any) => ({ source: r.source, count: parseInt(r.cnt) })),
  };
}
