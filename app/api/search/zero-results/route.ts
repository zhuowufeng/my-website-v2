/**
 * /api/search/zero-results — 零结果搜索词（搜索洞察）
 * 模块14：搜索能力
 *
 * GET /api/search/zero-results
 */

import { NextRequest, NextResponse } from 'next/server';
import { getZeroResultTerms } from '../../../../models/SearchQuery';
import { getAuthUserFromRequest } from '../../../../lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const days = Math.min(parseInt(searchParams.get('days') || '30'), 365);

    const terms = await getZeroResultTerms(limit, days);
    return NextResponse.json({ terms });
  } catch (error: any) {
    console.error('[Zero Results API] Error:', error.message);
    return NextResponse.json({ terms: [] });
  }
}
