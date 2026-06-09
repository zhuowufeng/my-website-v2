/**
 * /api/monitor/check — 手动触发检查
 *
 * POST /api/monitor/check — 检查所有活跃站点
 * POST /api/monitor/check?id=123 — 检查指定站点
 */

import { NextRequest, NextResponse } from 'next/server';
import * as SiteMonitor from '@/models/SiteMonitor';

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('id');

    let results;
    if (siteId) {
      const id = parseInt(siteId);
      if (isNaN(id)) {
        return NextResponse.json({ error: '无效的ID' }, { status: 400 });
      }
      const result = await SiteMonitor.checkSingleSite(id);
      results = [result];
    } else {
      results = await SiteMonitor.checkAllSites();
    }

    const totalChanges = results.reduce((sum, r) => sum + (r.changes?.length || 0), 0);

    return NextResponse.json({
      success: true,
      checked: results.length,
      totalChanges,
      results,
    });
  } catch (error) {
    console.error('[monitor/check] POST error:', (error as Error).message);
    return NextResponse.json({ error: '检查失败' }, { status: 500 });
  }
}
