/**
 * /api/data-browser/stats — 数据浏览器统计API
 * 模块10 验证：数据聚合统计
 */

import { NextRequest, NextResponse } from 'next/server';
import ScrapedDataQuery from '../../../../models/ScrapedDataQuery';
import { appCache, SEARCH_CACHE_TTL } from '../../../../lib/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'global';

  const cacheKey = `data-browser:stats:${type}`;
  const cached: any = appCache.get(cacheKey);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  try {
    let result;

    switch (type) {
      case 'domains':
        result = await ScrapedDataQuery.getDomainStats();
        break;
      case 'status_codes':
        result = await ScrapedDataQuery.getStatusCodeDistribution();
        break;
      case 'global':
      default:
        result = await ScrapedDataQuery.getGlobalStats();
        break;
    }

    appCache.set(cacheKey, result, { ttl: SEARCH_CACHE_TTL * 5 });

    return NextResponse.json({ data: result, cached: false });
  } catch (error: any) {
    console.error('[data-browser] Stats error:', error.message);
    return NextResponse.json(
      { error: '获取统计失败', detail: error.message },
      { status: 500 }
    );
  }
}
