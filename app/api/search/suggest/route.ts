/**
 * /api/search/suggest — 搜索建议（自动补全）
 * 模块14：搜索能力
 *
 * GET /api/search/suggest?q=前
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSearchSuggestions } from '../../../../models/SearchQuery';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';

  if (q.length < 1) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await getSearchSuggestions(q);
    return NextResponse.json({ suggestions, keyword: q });
  } catch (error: any) {
    console.error('[Search Suggest API] Error:', error.message);
    return NextResponse.json({ suggestions: [] });
  }
}
