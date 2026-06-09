/**
 * /api/monitor/stats — 监控统计概览
 *
 * GET: 获取监控统计（总数/活跃/变化数等）
 */

import { NextRequest, NextResponse } from 'next/server';
import * as SiteMonitor from '@/models/SiteMonitor';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ stats: null, recentChanges: [] });
    }

    const stats = await SiteMonitor.getMonitorStats(user.userId);
    const recentChanges = await SiteMonitor.getRecentChanges(user.userId, 10);

    return NextResponse.json({ stats, recentChanges });
  } catch (error) {
    console.error('[monitor/stats] error:', (error as Error).message);
    return NextResponse.json({ error: '获取统计失败' }, { status: 500 });
  }
}
