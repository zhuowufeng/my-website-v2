/**
 * /api/search/es — Elasticsearch 搜索API
 * 
 * 模块14·高级：Elasticsearch 搜索优化
 * 
 * 比 PostgreSQL 搜索更强：
 * - 模糊匹配（自动纠错）
 * - 多字段加权（标题3x > 内容）
 * - 短语匹配优先
 * - rank_feature 评分提升
 * - 搜索结果高亮
 * - 跨索引聚合统计
 * 
 * 使用方式：
 *   GET /api/search/es?q=关键词&source=articles&limit=10&fuzzy=true&sort=relevance
 *   GET /api/search/es/suggest?q=前&limit=5
 *   GET /api/search/es/health
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchES } from '../../../../lib/es-search';
import { isESAvailable } from '../../../../lib/es-client';
import { searchAll } from '../../../../models/SearchQuery';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { recordSearch } from '../../../../models/SearchQuery';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const source = searchParams.get('source') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
  const fuzzy = searchParams.get('fuzzy') !== 'false'; // 默认启用
  const highlight = searchParams.get('highlight') !== 'false';
  const sort = searchParams.get('sort') || 'relevance';

  if (!q) {
    return NextResponse.json({ results: [], total: 0, keyword: '', engine: 'elasticsearch' });
  }

  try {
    const user = await getAuthUserFromRequest(request);
    const esAvailable = await isESAvailable();

    let result;

    if (esAvailable) {
      // ES 搜索
      result = await searchES({
        keyword: q,
        limit,
        offset,
        source: source || undefined,
        fuzzy,
        highlight,
        sort,
      });
    } else {
      // ES 不可用时回退到 PostgreSQL 搜索
      console.log('[ES Search API] ⏭️ ES 不可用，回退到 PostgreSQL 搜索');

      const pgResult = await searchAll({
        keyword: q,
        limit,
        offset,
        source: source || undefined,
        userId: user?.userId,
        enableTypoCorrection: true,
        enableSynonyms: true,
      });

      result = {
        results: pgResult.results.map(r => ({
          ...r,
          highlight: null,
          _score: r.rank || 0,
        })),
        total: pgResult.total,
        keyword: pgResult.keyword || q,
        correctedFrom: pgResult.correctedFrom,
        wasCorrected: pgResult.wasCorrected,
        offset,
        limit,
        hasMore: pgResult.hasMore,
        engine: 'postgresql',
      };
    }

    // 记录搜索历史
    recordSearch({
      userId: user?.userId,
      keyword: q,
      resultCount: result.total,
      source: source || 'site',
    }).catch(() => {});

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ES Search API] Error:', error.message);

    // 出错时回退到 PostgreSQL
    try {
      console.log('[ES Search API] ⏭️ 出错，回退到 PostgreSQL 搜索');
      const pgResult = await searchAll({
        keyword: q,
        limit,
        offset,
        source: source || undefined,
        userId: null,
        enableTypoCorrection: true,
        enableSynonyms: true,
      });

      return NextResponse.json({
        results: pgResult.results,
        total: pgResult.total,
        keyword: pgResult.keyword || q,
        correctedFrom: pgResult.correctedFrom,
        wasCorrected: pgResult.wasCorrected,
        offset,
        limit,
        hasMore: pgResult.hasMore,
        engine: 'postgresql',
        fallback: true,
      });
    } catch {
      return NextResponse.json(
        { error: '搜索失败', detail: error.message },
        { status: 500 }
      );
    }
  }
}

// 支持让前端选择搜索引擎
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      keyword,
      limit = 10,
      offset = 0,
      source = '',
      fuzzy = true,
      highlight = true,
      sort = 'relevance',
      engine = 'auto', // auto | elasticsearch | postgresql
    } = body;

    if (!keyword?.trim()) {
      return NextResponse.json({ results: [], total: 0 });
    }

    const esAvailable = await isESAvailable();
    let useES = false;

    if (engine === 'elasticsearch' && !esAvailable) {
      return NextResponse.json(
        { error: 'Elasticsearch 未配置', detail: '请设置 ES_NODE 环境变量' },
        { status: 400 }
      );
    }

    if (engine === 'elasticsearch') useES = true;
    else if (engine === 'postgresql') useES = false;
    else useES = esAvailable; // auto: 优先用 ES

    let result;

    if (useES) {
      result = await searchES({
        keyword,
        limit,
        offset,
        source,
        fuzzy,
        highlight,
        sort,
      });
    } else {
      const pgResult = await searchAll({
        keyword,
        limit,
        offset,
        source: source || undefined,
        userId: null,
        enableTypoCorrection: true,
        enableSynonyms: true,
      });

      result = {
        results: pgResult.results,
        total: pgResult.total,
        keyword: pgResult.keyword || keyword,
        correctedFrom: pgResult.correctedFrom,
        wasCorrected: pgResult.wasCorrected,
        offset,
        limit,
        hasMore: pgResult.hasMore,
        engine: 'postgresql',
      };
    }

    // 记录搜索历史
    const user = await getAuthUserFromRequest(request);
    recordSearch({
      userId: user?.userId,
      keyword,
      resultCount: result.total,
      source: source || 'site',
    }).catch(() => {});

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ES Search API POST] Error:', error.message);
    return NextResponse.json(
      { error: '搜索失败', detail: error.message },
      { status: 500 }
    );
  }
}
