// /api/ads/stats — 广告与分析统计数据
import { NextRequest, NextResponse } from 'next/server';
import {
  getAdStats,
  getPageAnalytics,
  getRevenueStats,
  getDailySummary,
} from '@/models/AdPlacement';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // 需要登录
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';
    const days = parseInt(searchParams.get('days') || '7');

    let data;
    switch (type) {
      case 'ads':
        data = await getAdStats(days);
        break;
      case 'pages':
        data = await getPageAnalytics(days);
        break;
      case 'revenue':
        data = await getRevenueStats(days);
        break;
      case 'daily':
        data = await getDailySummary(days);
        break;
      case 'summary':
      default:
        const [adStats, pageStats, dailyStats] = await Promise.all([
          getAdStats(days),
          getPageAnalytics(days, 5),
          getDailySummary(days),
        ]);

        const totalImpressions = adStats.reduce((s, a) => s + parseInt(a.impressions || '0'), 0);
        const totalClicks = adStats.reduce((s, a) => s + parseInt(a.clicks || '0'), 0);
        const totalPageviews = pageStats.reduce((s, p) => s + parseInt(p.pageviews || '0'), 0);

        data = {
          overview: {
            totalPageviews,
            totalImpressions,
            totalClicks,
            ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00',
            days,
          },
          adStats,
          topPages: pageStats,
          daily: dailyStats,
        };
        break;
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[ads/stats] error:', err.message);
    return NextResponse.json(
      { error: 'Failed to get stats: ' + err.message },
      { status: 500 }
    );
  }
}
