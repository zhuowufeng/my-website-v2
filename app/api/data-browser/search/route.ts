/**
 * /api/data-browser/search — 数据浏览器搜索API
 * 模块10 验证：全文搜索 + 缓存 + 筛选 + 游标分页
 */

import { NextRequest, NextResponse } from 'next/server';
import ScrapedDataQuery from '../../../../models/ScrapedDataQuery';
import ArticleQuery from '../../../../models/ArticleQuery';
import { appCache, SEARCH_CACHE_TTL } from '../../../../lib/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dataset = searchParams.get('dataset') || 'scraped';
  const q = searchParams.get('q') || '';
  const domain = searchParams.get('domain') || '';
  const statusCode = searchParams.get('status_code') || '';
  const hasOgTags = searchParams.get('has_og_tags') || '';
  const sort = searchParams.get('sort') || 'crawled_at';
  const order = searchParams.get('order') || 'desc';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

  // Parse cursor
  let cursor = null;
  const cursorRaw = searchParams.get('cursor');
  if (cursorRaw) {
    try {
      cursor = JSON.parse(Buffer.from(cursorRaw, 'base64').toString());
    } catch {
      // Invalid cursor
    }
  }

  // Build cache key
  const cacheKey = `data-browser:${dataset}:${q}:${domain}:${statusCode}:${hasOgTags}:${sort}:${order}:${limit}:${cursorRaw || '0'}`;

  try {
    // Try cache first
    if (!q && !domain) {
      const cached: any = appCache.get(cacheKey);
      if (cached) {
        return NextResponse.json({ ...cached, cached: true });
      }
    }

    let result;
    if (dataset === 'articles') {
      result = await (ArticleQuery.search as any)(q, { limit });
    } else {
      result = await (ScrapedDataQuery.find as any)({
        limit,
        cursor,
        domain,
        statusCode,
        hasOgTags,
        sort,
        order,
        search: q,
      });
    }

    // Get stats for the sidebar
    let stats = null;
    if (dataset === 'scraped') {
      const statsKey = `data-browser:stats:${dataset}`;
      stats = appCache.get(statsKey) as any;
      if (!stats) {
        stats = await ScrapedDataQuery.getGlobalStats();
        appCache.set(statsKey, stats, { ttl: SEARCH_CACHE_TTL * 5 });
      }
    }

    // Build response
    const response = {
      data: result.data,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      stats,
      cached: false,
    };

    // Cache if no filters
    if (!q && !domain && !statusCode) {
      appCache.set(cacheKey, response, { ttl: 15_000 });
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[data-browser] Search error:', error.message);
    return NextResponse.json(
      { error: '搜索失败，请稍后重试', detail: error.message },
      { status: 500 }
    );
  }
}
