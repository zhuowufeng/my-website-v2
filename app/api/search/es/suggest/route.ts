/**
 * /api/search/es/suggest — ES 搜索建议
 */
import { NextRequest, NextResponse } from 'next/server';
import { getESSuggestions } from '../../../../../lib/es-search';
import { getSearchSuggestions } from '../../../../../models/SearchQuery';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 20);

  if (!q || q.length < 1) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    // 尝试用 ES，失败回退到 PostgreSQL
    let suggestions;
    try {
      suggestions = await getESSuggestions(q, limit);
    } catch {
      suggestions = [];
    }

    // 如果 ES 没出结果，用 PostgreSQL 回退
    if (!suggestions || suggestions.length === 0) {
      suggestions = await getSearchSuggestions(q, limit);
    }

    return NextResponse.json({
      suggestions: suggestions || [],
      prefix: q,
      engine: suggestions?.length > 0 ? 'elasticsearch' : 'postgresql',
    });
  } catch (error) {
    return NextResponse.json(
      { error: '获取搜索建议失败', detail: error.message },
      { status: 500 }
    );
  }
}
