/**
 * /api/monitor — 网站内容监控 API
 * 壁垒产品：定时爬取+内容比对+变化追踪
 *
 * GET: 获取用户的所有监控站点
 * POST: 添加要监控的URL
 */

import { NextRequest, NextResponse } from 'next/server';
import * as SiteMonitor from '@/models/SiteMonitor';
import { getAuthUserFromRequest } from '@/lib/auth';

// GET — 获取所有监控站点
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const sites = await SiteMonitor.getUserMonitoredSites(user.userId);
    const stats = await SiteMonitor.getMonitorStats(user.userId);

    return NextResponse.json({ sites, stats });
  } catch (error) {
    console.error('[monitor] GET error:', (error as Error).message);
    return NextResponse.json({ error: '获取监控列表失败' }, { status: 500 });
  }
}

// POST — 添加监控站点
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { url, name, checkInterval } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '请提供有效的URL' }, { status: 400 });
    }

    // 验证URL格式
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL格式无效' }, { status: 400 });
    }

    const site = await SiteMonitor.addMonitoredSite({
      url: url.trim(),
      name: name || '',
      userId: user.userId,
      checkInterval: checkInterval || '24h',
    });

    return NextResponse.json({ success: true, site });
  } catch (error) {
    console.error('[monitor] POST error:', (error as Error).message);
    return NextResponse.json({ error: '添加监控失败' }, { status: 500 });
  }
}
