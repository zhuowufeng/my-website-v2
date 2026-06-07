/**
 * /api/search — 全站搜索API
 * 模块14：搜索能力
 *
 * GET /api/search?q=关键词&source=articles&limit=10&offset=0
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchAll, recordSearch } from '../../../models/SearchQuery';
import { getAuthUserFromRequest } from '../../../lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const source = searchParams.get('source') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

  if (!q) {
    return NextResponse.json({ results: [], total: 0, keyword: '' });
  }

  try {
    const user = await getAuthUserFromRequest(request);

    const result = await searchAll({
      keyword: q,
      limit,
      offset,
      source: source || undefined,
      userId: user?.userId,
      enableTypoCorrection: true,
      enableSynonyms: true,
    });

    // Record search using the original keyword (not corrected one)
    recordSearch({
      userId: user?.userId,
      keyword: q,
      resultCount: result.total,
      source: source || 'site',
    }).catch(() => {});

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Search API] Error:', error.message);
    return NextResponse.json(
      { error: '搜索失败', detail: error.message },
      { status: 500 }
    );
  }
}
