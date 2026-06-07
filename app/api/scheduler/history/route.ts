/**
 * /api/scheduler/history — 定时诊断历史API
 * 模块13：执行历史查询
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHistoryStats, getRecentHistory, getScoreTrends } from '@/lib/scheduler';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = parseInt(searchParams.get('userId') || '0') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const type = searchParams.get('type') || 'history';

  try {
    if (type === 'stats') {
      const stats = await getHistoryStats(userId);
      return NextResponse.json({ stats });
    }

    if (type === 'trends') {
      const trends = await getScoreTrends(limit);
      return NextResponse.json({ trends });
    }

    const history = await getRecentHistory(limit, userId);
    return NextResponse.json({ history });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
