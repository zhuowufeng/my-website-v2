/**
 * POST /api/competitor-analyzer/analyze
 * 竞争对手全面分析 API
 *
 * 输入: { url: string }
 * 输出: 完整竞争对手分析报告
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeCompetitor, normalizeUrl, saveAnalysis } from '@/models/CompetitorAnalysis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, userId } = body;

    if (!url || !url.trim()) {
      return NextResponse.json({ error: '请提供网站URL' }, { status: 400 });
    }

    const normalizedUrl = normalizeUrl(url.trim());
    
    // Validate URL
    try {
      new URL(normalizedUrl);
    } catch {
      return NextResponse.json({ error: 'URL格式不正确，请检查' }, { status: 400 });
    }

    // Run analysis
    const result = await analyzeCompetitor(normalizedUrl);

    // Save to DB if user is logged in
    if (userId) {
      await saveAnalysis({
        userId,
        urls: [normalizedUrl],
        competitorData: result,
      }).catch(() => {}); // Silent fail on DB save
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[CompetitorAnalyzer] analyze error:', error);
    return NextResponse.json(
      { error: error.message || '分析失败，请稍后重试' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/competitor-analyzer/analyze?url=https://example.com
 * 快速分析（GET方式，适合预加载）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: '请提供 ?url= 参数' }, { status: 400 });
    }

    const normalizedUrl = normalizeUrl(url);
    
    try {
      new URL(normalizedUrl);
    } catch {
      return NextResponse.json({ error: 'URL格式不正确' }, { status: 400 });
    }

    const result = await analyzeCompetitor(normalizedUrl);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[CompetitorAnalyzer] analyze GET error:', error);
    return NextResponse.json(
      { error: error.message || '分析失败' },
      { status: 500 }
    );
  }
}
