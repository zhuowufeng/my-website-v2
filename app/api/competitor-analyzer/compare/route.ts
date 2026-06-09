/**
 * POST /api/competitor-analyzer/compare
 * 多站对比分析 API
 *
 * 输入: { urls: string[] }
 * 输出: 对比分析结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { compareCompetitors, normalizeUrl, saveAnalysis } from '@/models/CompetitorAnalysis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls, userId } = body;

    if (!urls || !Array.isArray(urls) || urls.length < 2) {
      return NextResponse.json({ error: '请提供至少2个网站URL进行对比' }, { status: 400 });
    }

    if (urls.length > 10) {
      return NextResponse.json({ error: '一次最多对比10个网站' }, { status: 400 });
    }

    const normalizedUrls = urls.map(u => normalizeUrl(u.trim()));

    // Validate URLs
    for (const url of normalizedUrls) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json({ error: `URL格式不正确: ${url}` }, { status: 400 });
      }
    }

    const result = await compareCompetitors(normalizedUrls);

    // Save to DB
    if (userId) {
      await saveAnalysis({
        userId,
        urls: normalizedUrls,
        competitorData: result,
      }).catch(() => {});
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[CompetitorAnalyzer] compare error:', error);
    return NextResponse.json(
      { error: error.message || '对比分析失败' },
      { status: 500 }
    );
  }
}
