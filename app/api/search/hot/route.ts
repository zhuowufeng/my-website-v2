/**
 * /api/search/hot — 热门搜索词
 * 模块14：搜索能力
 *
 * GET /api/search/hot
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHotSearchTerms } from '../../../../models/SearchQuery';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 90);

    const terms = await getHotSearchTerms(limit, days);
    return NextResponse.json({ terms });
  } catch (error: any) {
    console.error('[Hot Search API] Error:', error.message);
    return NextResponse.json({ terms: [] });
  }
}
