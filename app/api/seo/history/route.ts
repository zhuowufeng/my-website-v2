/**
 * /api/seo/history — SEO诊断历史API
 * 游标分页 + 统计
 */

import { NextRequest, NextResponse } from 'next/server';
import SEOAudit from '../../../../models/SEOAudit';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const type = searchParams.get('type') || 'list'; // list | stats | detail
  const id = searchParams.get('id');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  // Parse cursor
  let cursor = null;
  const cursorRaw = searchParams.get('cursor');
  if (cursorRaw) {
    try {
      cursor = JSON.parse(Buffer.from(cursorRaw, 'base64').toString());
    } catch { /* ignore */ }
  }

  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    if (type === 'detail' && id) {
      const analysis = await SEOAudit.getById(parseInt(id as string));
      if (!analysis) {
        return NextResponse.json({ error: '分析记录不存在' }, { status: 404 });
      }
      if (analysis.user_id !== parseInt(userId)) {
        return NextResponse.json({ error: '无权限访问' }, { status: 403 });
      }
      return NextResponse.json({ data: analysis });
    }

    if (type === 'stats') {
      const stats = await SEOAudit.getStats(parseInt(userId));
      return NextResponse.json({ data: stats });
    }

    const result = await (SEOAudit.getHistory as any)(parseInt(userId), { limit, cursor });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[seo-history] Error:', error.message);
    return NextResponse.json({ error: '获取历史失败' }, { status: 500 });
  }
}
