/**
 * /api/keyword-research — 关键词挖掘工具 API
 * 壁垒产品：爬取多源搜索建议 + 聚合分析，不是AI问答能替代的
 * 
 * POST: 执行关键词研究
 * GET: 获取研究历史
 */

import { NextRequest, NextResponse } from 'next/server';
import { researchKeywords, formatKeywordResults } from '../../../lib/keyword-suggester';
import * as KeywordResearchModel from '../../../models/KeywordResearch';
import { getAuthUserFromRequest } from '../../../lib/auth';

// POST — 执行关键词研究
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyword } = body;

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return NextResponse.json({ error: '请提供有效的关键词' }, { status: 400 });
    }

    if (keyword.trim().length > 100) {
      return NextResponse.json({ error: '关键词太长了，限制100个字符' }, { status: 400 });
    }

    // 执行关键词研究
    const rawResults = await researchKeywords(keyword.trim());
    const formatted = formatKeywordResults(rawResults);

    // 如果用户已登录，保存历史
    const user = await getAuthUserFromRequest(request);
    let saved = null;
    if (user) {
      try {
        await KeywordResearchModel.createTable();
        saved = await KeywordResearchModel.saveKeywordResearch(
          user.userId,
          formatted.seedKeyword,
          formatted.totalKeywords,
          formatted
        );
      } catch (err) {
        console.warn('[keyword-research] Failed to save history:', (err as Error).message);
      }
    }

    return NextResponse.json({
      ...formatted,
      saved,
    });
  } catch (error) {
    console.error('[keyword-research] Error:', (error as Error).message);
    return NextResponse.json({ error: '关键词研究失败，请稍后重试' }, { status: 500 });
  }
}

// GET — 获取研究历史
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    await KeywordResearchModel.createTable();

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const history = await KeywordResearchModel.getKeywordHistory(user.userId, limit, offset);
    const stats = await KeywordResearchModel.getKeywordStats(user.userId);

    return NextResponse.json({
      history,
      stats,
    });
  } catch (error) {
    console.error('[keyword-research] Error:', (error as Error).message);
    return NextResponse.json({ error: '获取历史失败' }, { status: 500 });
  }
}
