/**
 * /api/monitor/[id] — 单个监控站点操作
 *
 * GET: 获取站点详情（含快照历史+变化记录）
 * DELETE: 移除监控
 * PATCH: 更新监控配置（激活/停用）
 */

import { NextRequest, NextResponse } from 'next/server';
import * as SiteMonitor from '@/models/SiteMonitor';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    const detail = await SiteMonitor.getMonitoredSiteDetail(id, user.userId);
    if (!detail) {
      return NextResponse.json({ error: '监控站点不存在' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error('[monitor/id] GET error:', (error as Error).message);
    return NextResponse.json({ error: '获取站点详情失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    await SiteMonitor.removeMonitoredSite(id, user.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[monitor/id] DELETE error:', (error as Error).message);
    return NextResponse.json({ error: '移除监控失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    const body = await request.json();
    if (body.activate === true) {
      await SiteMonitor.activateMonitoredSite(id, user.userId);
    } else if (body.activate === false) {
      await SiteMonitor.removeMonitoredSite(id, user.userId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[monitor/id] PATCH error:', (error as Error).message);
    return NextResponse.json({ error: '更新监控失败' }, { status: 500 });
  }
}
